import type { Message as ChatMessage } from '@flamingo-stack/openframe-frontend-core';
import { createChatDialogStore, DEFAULT_DIALOG_SIDE } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { describe, expect, it } from 'vitest';
import { bindMingoDialog, useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { createReducerMirror, type ReducerMirrorSnapshot } from '@/lib/chat-stream-thread';

/**
 * Regression tests for the history-hydration seam.
 *
 * The bridge (`chat-stream-thread`) + the reducer own every accumulation rule,
 * so the ONE thing the app still decides is HOW a hydrated thread enters the
 * reducer. Getting that wrong is invisible to `tsc` and shows up only as a
 * mid-stream reload silently eating the persisted head of a turn — which is
 * exactly what these pin.
 */

function hydratedThread(): ChatMessage[] {
  return [
    { id: 'u1', role: 'user', content: 'Run a health check across my endpoints.' },
    {
      id: 'a1',
      role: 'assistant',
      content: [{ type: 'text', text: "I'll kick this off in parallel." }],
    } as ChatMessage,
  ];
}

/**
 * The same thread, but with the trailing turn left UNFINISHED — an
 * EXECUTING_TOOL with no result, which is what `extractIncompleteTailState`
 * looks for. This is the state a reload catches: the agent is mid-turn.
 */
function unfinishedThread(): ChatMessage[] {
  return [
    { id: 'u1', role: 'user', content: 'Run a health check across my endpoints.' },
    {
      id: 'a1',
      role: 'assistant',
      content: [
        { type: 'text', text: "I'll kick this off in parallel." },
        {
          type: 'tool_execution',
          data: {
            type: 'EXECUTING_TOOL',
            integratedToolType: 'openframe',
            toolFunction: 'search_machines',
            toolExecutionRequestId: 'req-1',
          },
        },
      ],
    } as ChatMessage,
  ];
}

/**
 * `apply` BATCHES body deltas into an animation frame (`createDeltaBatcher`) —
 * only non-delta events and `mutate` force a flush. Reading the store straight
 * after an `apply` therefore sees the pre-delta thread; wait a frame first.
 */
function flushDeltas(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/** Flatten whatever shape the mirror hands back into plain text. */
function textOf(message: ChatMessage | undefined): string {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  return message.content.map(segment => (segment.type === 'text' ? segment.text : '')).join('');
}

describe('history hydration → reducer', () => {
  it('APPENDS a delta that arrives with no preceding turn-start', async () => {
    // The mid-stream reload shape: the turn opened server-side before this
    // client subscribed, so the catchup replay resumes PAST its MESSAGE_START
    // and the first chunk to land is a bare delta.
    const dialogId = 'dialog-append';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, hydratedThread());
    bindMingoDialog(dialogId).apply({ type: 'text-delta', text: ' Two endpoints online.' });
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    const assistant = messages.at(-1);

    // The persisted head of the turn must survive. Before the fix the reducer
    // looked cold, took the cold-start cumulative path, and REPLACED it.
    expect(textOf(assistant)).toContain("I'll kick this off in parallel.");
    expect(textOf(assistant)).toContain('Two endpoints online.');
    // And the user bubble above it is untouched.
    expect(messages[0]?.id).toBe('u1');
  });

  it('keeps untouched messages referentially stable across an apply', async () => {
    // The whole point of the bidirectional WeakMap cache: per-message React
    // memoization (and the history merge's reference reuse) depends on an
    // untouched reducer message converting back to the SAME app instance.
    const dialogId = 'dialog-identity';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, hydratedThread());
    const before = useMingoMessagesStore.getState().getMessages(dialogId);

    bindMingoDialog(dialogId).apply({ type: 'text-delta', text: ' more' });
    await flushDeltas();

    const after = useMingoMessagesStore.getState().getMessages(dialogId);
    // The user bubble took no part in this event — same object, not a clone.
    expect(after[0]).toBe(before[0]);
  });
});

describe('adopt-once', () => {
  it('lets a REPLAYED turn-start re-stream into the unfinished bubble', async () => {
    // After a reload the catchup replay re-streams the turn from its
    // MESSAGE_START. Without the armed flag the reducer treats the hydrated
    // bubble as a completed one and opens a duplicate beside it — which is
    // what "the chunks start floating" looks like.
    const dialogId = 'dialog-adopt';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, unfinishedThread());
    const hydratedCount = useMingoMessagesStore.getState().getMessages(dialogId).length;

    bindMingoDialog(dialogId).apply({ type: 'turn-start' });
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(messages).toHaveLength(hydratedCount);
    expect(textOf(messages.at(-1))).toContain("I'll kick this off in parallel.");
  });

  it('disarms on the first event that is not a turn-start', async () => {
    // The flag may not outlive the replay it was armed for: a later GENUINE
    // turn must open its own bubble instead of overwriting a finished one.
    const dialogId = 'dialog-disarm';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, unfinishedThread());
    const hydratedCount = useMingoMessagesStore.getState().getMessages(dialogId).length;

    // No replay came; something else lands first and burns the flag.
    bindMingoDialog(dialogId).apply({ type: 'text-delta', text: ' continuing.' });
    await flushDeltas();
    // Now a genuine new turn starts.
    bindMingoDialog(dialogId).apply({ type: 'turn-start' });
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(messages).toHaveLength(hydratedCount + 1);
    expect(textOf(messages.at(-1))).toBe('');
  });
});

describe('LRU eviction', () => {
  it('parks and restores a thread when the store drops its reducer', () => {
    // The store evicts least-recently-used reducers behind an UNCHANGED key.
    // Nothing re-fetches on eviction, so if the mirror did not park the thread
    // the host would keep rendering a snapshot the reducer no longer holds —
    // and the next write would publish an empty one.
    const snapshots = new Map<string, ReducerMirrorSnapshot>();
    const mirror = createReducerMirror<string>({
      // Cap of ONE: touching a second key is guaranteed to evict the first.
      createStore: storeOptions => createChatDialogStore({ ...storeOptions, maxReducers: 1 }),
      identityFor: key => ({
        dialogId: key,
        side: DEFAULT_DIALOG_SIDE,
        defaults: { assistantName: 'Mingo', assistantType: 'mingo' },
      }),
      options: () => ({}),
      onSnapshot: (key, snapshot) => {
        snapshots.set(key, snapshot);
      },
    });

    mirror.hydrate('a', unfinishedThread());
    // A key handed out by `getReducer` is protected from eviction until its
    // FIRST retain lands (the store stands in for the retain a rendering host
    // has not committed yet). Retain then release to reach the state a real
    // host is in once its panel unmounts: known, but no longer pinned.
    mirror.setActiveKeys(['a']);
    mirror.setActiveKeys([]);
    const epochBefore = mirror.bind('a').evictionEpoch;

    // Touch a second key — 'a' is now the LRU entry and gets dropped.
    mirror.hydrate('b', [{ id: 'u2', role: 'user', content: 'unrelated' }]);

    // Come back to 'a'. `mutate` resolves its reducer, which is where the
    // mirror replays the parked state into the replacement instance.
    mirror.mutate('a', () => undefined);

    const restored = snapshots.get('a');
    expect(restored?.messages).toHaveLength(2);
    expect(textOf(restored?.messages.at(-1))).toContain("I'll kick this off in parallel.");
    // The epoch moved, which is what re-arms the consumers' post-eviction
    // re-seed (`useChatChunkProcessor`) against the new instance.
    expect(mirror.bind('a').evictionEpoch).toBeGreaterThan(epochBefore);
  });
});
