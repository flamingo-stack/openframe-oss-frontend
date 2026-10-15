import type { RecordRemoteSessionActionInput } from '@/__generated__/remoteSessionActionsApiServiceRecordMutation.graphql';
import { type Instant, toInstant } from '@/lib/graphql-scalars';
import {
  isRetryableReportError,
  type RemoteSessionAction,
  recordRemoteSessionAction,
  toActionInput,
} from './remote-session-actions-api-service';

/** Waits before the 1st, 2nd and 3rd resend of an action whose request got no answer; then it is dropped. */
const RETRY_DELAYS_MS = [1_000, 3_000, 10_000];
/** Reports kept while the API is unreachable; past this the oldest go, so a long outage cannot grow the queue. */
const MAX_QUEUED = 100;

export interface RemoteSessionActionReporterDeps {
  send: (input: RecordRemoteSessionActionInput) => Promise<unknown>;
  newEventId: () => string;
  now: () => Instant;
  sleep: (ms: number) => Promise<void>;
}

/** A v4 UUID; `crypto.randomUUID` is missing outside secure contexts. */
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const DEFAULT_DEPS: RemoteSessionActionReporterDeps = {
  send: recordRemoteSessionAction,
  newEventId: uuid,
  now: () => toInstant(new Date()),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

interface QueuedReport {
  input: RecordRemoteSessionActionInput;
  resends: number;
}

/**
 * Reports one session's console actions, in order, one request at a time.
 * `report` returns at once and never throws: the console never waits on the
 * API. Every action gets its own `clientEventId`, and a resend keeps it, so
 * the server stores an action once however often it is sent. Only a request
 * that got no answer is resent; a refusal is final and the action is dropped.
 */
export class RemoteSessionActionReporter {
  private readonly queue: QueuedReport[] = [];
  private draining = false;

  constructor(
    private readonly sessionId: string,
    private readonly deps: RemoteSessionActionReporterDeps = DEFAULT_DEPS,
  ) {}

  report(action: RemoteSessionAction): void {
    const input = toActionInput(this.sessionId, action, this.deps.newEventId(), this.deps.now());
    if (!input) return;
    if (this.queue.length >= MAX_QUEUED) this.queue.shift();
    this.queue.push({ input, resends: 0 });
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue[0];
        try {
          await this.deps.send(next.input);
          this.queue.shift();
        } catch (error) {
          if (!isRetryableReportError(error) || next.resends >= RETRY_DELAYS_MS.length) {
            this.queue.shift();
            continue;
          }
          await this.deps.sleep(RETRY_DELAYS_MS[next.resends]);
          next.resends += 1;
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
