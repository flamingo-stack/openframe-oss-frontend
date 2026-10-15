/**
 * History merges landing in the middle of replayed turns: the real Mingo store,
 * lib reducer and lib history merge, no NATS and no React, driven in the order
 * a refetch racing a replay produced them.
 *
 * Regression for the splice half of the "burst of old messages" report: every
 * merge goes through `hydrate`, which re-seeded the turn kernel from the
 * trailing assistant run — and mid-turn that run spans the newest persisted
 * turn AND the live bubble. The next chunk then rewrote the live bubble as both
 * turns, and that "richer" copy later replaced the persisted row.
 */
import { maxPersistedStreamSeq, mergeHistoryWithRealtime } from '@flamingo-stack/openframe-frontend-core';
import { decodeNatsChunk } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { bindMingoDialog, useMingoMessagesStore } from '../stores/mingo-messages-store';
import {
  countOccurrences,
  DIALOG,
  persistedRows,
  processMingoHistory,
  publishTurn,
  renderedText,
  SUBJECT,
  thread,
} from './chat-fixtures';
import { FakeJetStream } from './fake-jetstream';

type Rows = ReturnType<typeof persistedRows>;

const store = () => useMingoMessagesStore.getState();

/** The full-merge branch `use-mingo-dialog-selection` runs on a history
 *  (re)fetch, without its pending-approvals fold (these turns have none). */
function merge(rows: Rows, streamingId: string | null) {
  const merged = mergeHistoryWithRealtime({
    processedHistory: processMingoHistory(rows),
    rawHistoryIds: new Set(rows.map(r => r.id)),
    existingMessages: thread(),
    streamingMessageId: streamingId,
    historyFetchedAt: Date.now(),
    historyMaxStreamSeq: maxPersistedStreamSeq([{ messages: rows }]),
    realtimeSeenStreamSeq: store().getHighestStreamSeq(DIALOG),
  });
  store().setMessages(DIALOG, merged);
}

beforeEach(() => {
  store().resetAll();
  store().setActiveDialogId(DIALOG);
});

describe('history merge landing in the middle of a replayed turn', () => {
  it("does not splice another turn's segments into the replayed bubble", () => {
    const js = new FakeJetStream();
    const turns = [0, 1, 2].map(i => publishTurn(js, i));
    const rows = turns.flatMap((t, i) => persistedRows(t, i, true, Date.now() - (3 - i) * 60_000));
    merge(rows, null);

    // Turns 1 and 2 finished during an outage; history already has both, and
    // the resumed consumer replays them.
    const bound = bindMingoDialog(DIALOG);
    const chunks = js.msgs
      .filter(m => m.subject === SUBJECT && m.seq >= turns[1].seqs.request)
      .map(m => ({ ...JSON.parse(new TextDecoder().decode(m.data)), streamSeq: m.seq }));
    const applyUpTo = (type: string) => {
      while (chunks.length) {
        const chunk = chunks.shift();
        store().recordHighestStreamSeq(DIALOG, chunk.streamSeq);
        const event = decodeNatsChunk(chunk);
        if (event) bound.apply(event);
        if (chunk.type === type) return;
      }
    };

    // Turn 1's replay, a merge landing mid-turn, the rest of it, a merge at its end.
    applyUpTo('EXECUTING_TOOL');
    const streamingId = store().getStreamingId(DIALOG);
    merge(rows, streamingId);
    applyUpTo('MESSAGE_END');
    const replayed = thread().find(m => m.id === streamingId);
    merge(rows, null);
    // Turn 2's, the same way.
    applyUpTo('EXECUTING_TOOL');
    merge(rows, store().getStreamingId(DIALOG));
    applyUpTo('MESSAGE_END');
    merge(rows, null);
    applyUpTo('TOKEN_USAGE');

    expect(replayed && renderedText(replayed)).not.toContain('ORG-SECRET-2');
    expect(countOccurrences(thread(), 'ORG-SECRET-1')).toBe(1);
    expect(countOccurrences(thread(), turns[1].answer)).toBe(1);
    expect(thread().some(m => m.id === 'mongo-asst-2')).toBe(true);
  });
});
