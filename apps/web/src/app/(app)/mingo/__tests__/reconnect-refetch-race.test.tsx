/**
 * The live-session path end to end: the real `useMingoDialogSelection` (history
 * query + merge) wired to the real `DialogSubscription` the way the drawer
 * wires them (`use-mingo-unified-chat-state` → `openframe-embeddable-chat-entry`),
 * over an in-memory JetStream and a mocked history endpoint.
 *
 * Regression for the "burst of old messages" report. After an outage the tail
 * resumes from the highest sequence it saw AND the app refetches history. When
 * the refetch landed first, the merge ran without the turns that finished
 * during the outage, and their replay then rendered every one of them a second
 * time; nothing re-merged afterwards. The refetch now waits for the replay.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoDialogSelection } from '../hooks/use-mingo-dialog-selection';
import { DialogSubscription } from '../hooks/use-mingo-realtime-subscription';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { Message } from '../types';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { countOccurrences, DIALOG, historyPage, persistedRows, publishTurn } from './chat-fixtures';
import { FakeJetStream } from './fake-jetstream';

const h = vi.hoisted(() => ({
  server: null as unknown as FakeJetStream,
  db: [] as Array<Record<string, unknown>>,
  dbDelayMs: 0,
  fetches: 0,
}));
h.server = new FakeJetStream();

vi.mock('nats.ws', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  connect: () => h.server.connect(),
}));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'ws://fake', onBeforeReconnect: async () => {} }),
}));
vi.mock('../queries/fetch-dialog-messages', () => ({
  fetchMingoDialogMessages: async () => {
    h.fetches++;
    // Snapshot at request time, delivered after the latency — like a real query.
    const rows = [...h.db].reverse();
    if (h.dbDelayMs > 0) await new Promise(r => setTimeout(r, h.dbDelayMs));
    return {
      ok: true,
      data: {
        data: {
          messages: {
            edges: rows.map(node => ({ cursor: String(node.id), node })),
            pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
          },
        },
      },
    };
  },
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: async () => ({
      ok: true,
      status: 200,
      data: {
        data: {
          dialog: {
            id: DIALOG,
            title: 'Defender onboarding',
            streamState: 'IDLE',
            createdAt: new Date(Date.now() - 3600_000).toISOString(),
          },
        },
      },
    }),
  },
}));

function Host() {
  const sel = useMingoDialogSelection();
  const activeDialogId = useMingoMessagesStore(s => s.activeDialogId);
  const { selectDialog } = sel;
  useEffect(() => {
    selectDialog(DIALOG);
  }, [selectDialog]);
  if (!activeDialogId) return null;
  return (
    <DialogSubscription
      key={activeDialogId}
      dialogId={activeDialogId}
      isActive
      onApprove={sel.handleApprove}
      onReject={sel.handleReject}
      approvalStatuses={sel.approvalStatuses}
      initialOptStartSeq={sel.initialOptStartSeq}
      isInitialOptStartSeqReady={sel.isMessagesFetchedAfterMount}
    />
  );
}

let root: Root | null = null;

function thread(): Message[] {
  return useMingoMessagesStore.getState().messagesByDialog.get(DIALOG) ?? [];
}

async function wait(ms: number) {
  const step = 25;
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await new Promise(r => setTimeout(r, step));
    });
  }
}

async function open(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <Host />
      </QueryClientProvider>,
    );
  });
}

/** Persist and publish turns `ids`, as finished before `now`. */
function finishTurns(ids: number[], { stamp = true, now = Date.now() } = {}) {
  return ids.map(i => {
    const t = publishTurn(h.server, i);
    h.db.push(...persistedRows(t, i, stamp, now - (10 - i) * 30_000));
    return t;
  });
}

/** An outage during which `ids` finish, then the reconnect (retry ≈ 0.5–1s) and both requests. */
async function outage(ids: number[], order: { dbDelayMs: number; consumeDelayMs: number }) {
  h.server.disconnectAll();
  await wait(50);
  const missed = ids.map(i => {
    const t = publishTurn(h.server, i);
    h.db.push(...persistedRows(t, i, true, Date.now() + i));
    return t;
  });
  h.dbDelayMs = order.dbDelayMs;
  h.server.consumeDelayMs = order.consumeDelayMs;
  await wait(2500);
  return missed;
}

const REFETCH_FIRST = { dbDelayMs: 0, consumeDelayMs: 300 };
const REPLAY_FIRST = { dbDelayMs: 300, consumeDelayMs: 0 };

beforeEach(() => {
  h.server.reset();
  h.db = [];
  h.dbDelayMs = 0;
  h.fetches = 0;
  useMingoMessagesStore.getState().resetAll();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await wait(50);
});

describe('reconnect: history refetch vs JetStream resume', () => {
  for (const [name, order] of [
    ['replay lands first', REPLAY_FIRST],
    ['refetch would land first', REFETCH_FIRST],
  ] as const) {
    it(`${name}: a turn finished during the outage renders once`, async () => {
      finishTurns([0, 1]);
      await open();
      await wait(400);
      const live = publishTurn(h.server, 2);
      h.db.push(...persistedRows(live, 2, true, Date.now()));
      await wait(300);
      expect(countOccurrences(thread(), live.answer)).toBe(1);

      const [missed] = await outage([3], order);

      expect(countOccurrences(thread(), live.answer)).toBe(1);
      expect(countOccurrences(thread(), missed.answer)).toBe(1);
    }, 20_000);

    it(`${name}: several turns finished during the outage render once each, persisted rows kept`, async () => {
      const [first] = finishTurns([0]);
      await open();
      await wait(400);

      const missed = await outage([1, 2, 3], order);

      for (const t of [first, ...missed]) expect(countOccurrences(thread(), t.answer)).toBe(1);
      for (const i of [0, 1, 2, 3]) expect(thread().some(m => m.id === `mongo-asst-${i}`)).toBe(true);
    }, 20_000);
  }

  it('refetches history once the replay is in, not as the tail comes back', async () => {
    finishTurns([0]);
    await open();
    await wait(400);
    const fetchesBefore = h.fetches;

    h.server.disconnectAll();
    await wait(50);
    publishTurn(h.server, 1);
    h.server.consumeDelayMs = 1500;
    // Past the reconnect, short of the delayed replay.
    await wait(1400);
    expect(h.fetches).toBe(fetchesBefore);

    await wait(1500);
    expect(h.fetches).toBe(fetchesBefore + 1);
  }, 20_000);
});

describe('open with history the stamps cannot place on the stream', () => {
  it('unstamped history: turns the stream still retains are neither duplicated nor spliced', async () => {
    const turns = finishTurns([0, 1, 2], { stamp: false });
    await open();
    await wait(800);

    for (const t of turns) expect(countOccurrences(thread(), t.answer)).toBe(1);
    expect(thread().filter(m => m.role === 'assistant')).toHaveLength(3);
  }, 20_000);

  it('stamped history: nothing duplicated', async () => {
    const turns = finishTurns([0, 1, 2]);
    await open();
    await wait(800);

    for (const t of turns) expect(countOccurrences(thread(), t.answer)).toBe(1);
  }, 20_000);
});

describe('re-entry with the previous visit still cached', () => {
  it('starts the tail after the fresh history, not the cached pages', async () => {
    const [seen] = finishTurns([0]);
    // The previous visit's pages, still inside staleTime; this client's own
    // cursor is gone (the dialog fell out of the store's LRU).
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(mingoDialogQueryKeys.messages(DIALOG), {
      pages: [historyPage(persistedRows(seen, 0, true, Date.now() - 300_000))],
      pageParams: [undefined],
    });
    // Finished while the user was away.
    const away = finishTurns([1, 2]);
    h.server.consumeDelayMs = 300;

    await open(queryClient);
    await wait(1000);

    for (const t of [seen, ...away]) expect(countOccurrences(thread(), t.answer)).toBe(1);
    expect(h.server.createdConsumers[0]).toMatchObject({ opt_start_seq: away[1].seqs.lastContent + 1 });
  }, 20_000);
});
