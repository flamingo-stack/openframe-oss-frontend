/**
 * In-memory JetStream behind a `connect` that replaces nats.ws's, for driving
 * the real `DialogSubscription` (and the lib client under it) without a server.
 *
 * The consumer CONFIG is not re-implemented: it is what nats.ws's own
 * `OrderedPullConsumerImpl.getConsumerOpts` builds before `CONSUMER.CREATE`
 * (loaded from the installed package past its exports map), so a nats.ws quirk
 * — a start sequence of 0 becoming 1 — shows up here as it does against a real
 * server. Only the server half is simulated, with JetStream's semantics:
 * `by_start_sequence` delivers every retained message from `opt_start_seq` on,
 * `new` delivers nothing retained, retention is `Limits` + `maxAge` (CHAT_CHUNKS:
 * 10 minutes), and each message carries the `pending` count the server would
 * put in its reply subject.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export interface ServerConsumerConfig {
  name: string;
  deliver_policy: string;
  opt_start_seq?: number;
  filter_subject?: string;
}

interface OrderedConsumerConfigBuilder {
  cursor: { stream_seq: number };
  getConsumerOpts: (seq: number) => ServerConsumerConfig;
}

const loadCjs = createRequire(import.meta.url);
const { OrderedPullConsumerImpl } = loadCjs(
  join(dirname(loadCjs.resolve('nats.ws')), '../lib/jetstream/consumer.js'),
) as {
  OrderedPullConsumerImpl: new (
    api: unknown,
    stream: string,
    opts: Record<string, unknown>,
  ) => OrderedConsumerConfigBuilder;
};

/** What nats.ws sends the server for these `consumers.get` options. */
function orderedConsumerServerConfig(stream: string, opts: Record<string, unknown>): ServerConsumerConfig {
  const impl = new OrderedPullConsumerImpl({}, stream, opts);
  // `reset()` → `resetConsumer(cursor.stream_seq + 1)`, which maps 0 to 1.
  const seq = impl.cursor.stream_seq + 1;
  return impl.getConsumerOpts(seq === 0 ? 1 : seq);
}

interface StoredMsg {
  seq: number;
  subject: string;
  data: Uint8Array;
  time: number;
}

interface StatusEvent {
  type: string;
  data?: unknown;
}

/** A pull-style queue that ends when closed. */
class Queue<T> {
  private items: T[] = [];
  private waiter: ((r: IteratorResult<T>) => void) | null = null;
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w({ value: item, done: false });
    } else this.items.push(item);
  }

  close(): void {
    this.closed = true;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () =>
        new Promise<IteratorResult<T>>(resolve => {
          const item = this.items.shift();
          if (item !== undefined) resolve({ value: item, done: false });
          else if (this.closed) resolve({ value: undefined, done: true });
          else this.waiter = resolve;
        }),
    };
  }
}

interface LiveConsumer {
  filter: string;
  conn: object;
  deliver: (m: StoredMsg) => void;
  end: () => void;
}

export class FakeJetStream {
  msgs: StoredMsg[] = [];
  nextSeq = 1;
  maxAgeMs = 10 * 60_000;
  createdConsumers: ServerConsumerConfig[] = [];
  /** Latency between CONSUMER.CREATE and the first delivered message. */
  consumeDelayMs = 0;
  private live = new Set<LiveConsumer>();
  private conns = new Set<{ drop: () => void }>();

  /** The lib keeps one shared connection per URL across tests: reset the state, keep the instance. */
  reset(): void {
    this.msgs = [];
    this.nextSeq = 1;
    this.createdConsumers = [];
    this.consumeDelayMs = 0;
    this.live.clear();
  }

  publish(subject: string, payload: unknown): number {
    const msg: StoredMsg = {
      seq: this.nextSeq++,
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
      time: Date.now(),
    };
    this.msgs.push(msg);
    for (const c of this.live) if (c.filter === subject) c.deliver(msg);
    return msg.seq;
  }

  /** Burn stream sequences on another subject (other dialogs share the stream). */
  publishNoise(count: number): void {
    for (let i = 0; i < count; i++) this.publish('chat.other-dialog.admin-message', { type: 'TEXT', text: 'x' });
  }

  /** Server-side connection loss: every socket closes, its consumers stop. */
  disconnectAll(): void {
    for (const c of [...this.conns]) c.drop();
  }

  private retainedAfter(filter: string, firstSeq: number): StoredMsg[] {
    const floor = Date.now() - this.maxAgeMs;
    return this.msgs.filter(m => m.subject === filter && m.time >= floor && m.seq >= firstSeq);
  }

  /** The `nats.ws` `connect()` replacement. */
  connect = async () => {
    let closed = false;
    const status = new Queue<StatusEvent>();
    const token = {};
    const connEntry = {
      drop: () => {
        closed = true;
        this.conns.delete(connEntry);
        for (const c of [...this.live]) if (c.conn === token) c.end();
        status.push({ type: 'disconnect', data: 'fake' });
      },
    };
    this.conns.add(connEntry);
    return {
      isClosed: () => closed,
      closed: () => new Promise(() => {}),
      drain: async () => {
        closed = true;
      },
      close: async () => {
        closed = true;
      },
      status: () => status,
      publish: () => {},
      subscribe: () => ({ unsubscribe() {}, [Symbol.asyncIterator]: async function* () {} }),
      jetstream: () => ({
        consumers: {
          get: async (stream: string, opts: Record<string, unknown>) => {
            const config = orderedConsumerServerConfig(stream, opts);
            this.createdConsumers.push(config);
            const filter = String(opts.filterSubjects);
            const messages = new Queue<unknown>();
            const consumerStatus = new Queue<StatusEvent>();
            const toJsMsg = (m: StoredMsg, pending: number) => ({
              data: m.data,
              subject: m.subject,
              info: { streamSequence: m.seq, pending },
            });
            let info = { name: config.name, num_pending: 0 };

            const entry: LiveConsumer = {
              filter,
              conn: token,
              deliver: m => messages.push(toJsMsg(m, 0)),
              end: () => {
                this.live.delete(entry);
                messages.close();
                consumerStatus.close();
              },
            };

            return {
              info: async () => info,
              consume: async () => {
                const backlog =
                  config.deliver_policy === 'by_start_sequence'
                    ? this.retainedAfter(filter, config.opt_start_seq ?? 1)
                    : [];
                info = { name: config.name, num_pending: backlog.length };
                this.live.add(entry);
                const deliverBacklog = () => {
                  backlog.forEach((m, i) => {
                    messages.push(toJsMsg(m, backlog.length - 1 - i));
                  });
                };
                if (this.consumeDelayMs > 0) setTimeout(deliverBacklog, this.consumeDelayMs);
                else deliverBacklog();
                return {
                  status: async () => consumerStatus,
                  close: async () => entry.end(),
                  [Symbol.asyncIterator]: () => messages[Symbol.asyncIterator](),
                };
              },
            };
          },
        },
      }),
    };
  };
}
