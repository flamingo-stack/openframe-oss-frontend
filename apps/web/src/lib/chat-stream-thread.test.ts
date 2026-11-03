import {
  type ChatMessage,
  type ChatStreamEntry,
  type ChatToolPart,
  isToolPart,
  textOfParts,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { createChatDialogStore, DEFAULT_DIALOG_SIDE } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { describe, expect, it } from 'vitest';
import { bindMingoDialog, useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { bindTicketSide, useTicketDetailsStore } from '@/app/(app)/tickets/stores/ticket-details-store';
import { createReducerMirror, type ReducerMirrorSnapshot } from '@/lib/chat-stream-thread';

/**
 * Regression tests for the history-hydration seam.
 *
 * The mirror (`chat-stream-thread`) + the reducer own every accumulation rule,
 * so the ONE thing the app still decides is HOW a hydrated thread enters the
 * reducer. Getting that wrong is invisible to `tsc` and shows up only as a
 * mid-stream reload silently eating the persisted head of a turn — which is
 * exactly what these pin.
 */

const userRow = (id: string, text: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

function hydratedThread(): ChatMessage[] {
  return [
    userRow('u1', 'Run a health check across my endpoints.'),
    { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: "I'll kick this off in parallel." }] },
  ];
}

/**
 * The same thread, but with the trailing turn left UNFINISHED — a tool that
 * started with no result, which is what `extractIncompleteTailState`
 * looks for. This is the state a reload catches: the agent is mid-turn.
 */
function unfinishedThread(): ChatMessage[] {
  return [
    userRow('u1', 'Run a health check across my endpoints.'),
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'text', text: "I'll kick this off in parallel." },
        {
          type: 'dynamic-tool',
          toolName: 'search_machines',
          toolCallId: 'req-1',
          toolMetadata: { integratedToolType: 'openframe' },
          state: 'input-available',
          input: {},
        },
      ],
    },
  ];
}

/**
 * The same thread blocked on the USER instead: a pending approval at the tail.
 * Unfinished by the extractor's rules too, so a hydrate arms adoption — but
 * nothing is executing, so the phase stays idle.
 */
function pendingApprovalThread(): ChatMessage[] {
  return [
    userRow('u1', 'run it'),
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'This needs your go-ahead.' },
        {
          type: 'dynamic-tool',
          toolName: 'command',
          toolCallId: 'req-9',
          title: 'rm -rf /tmp/cache',
          state: 'approval-requested',
          input: {},
          approval: { id: 'req-9', descriptor: { approvalType: 'CLIENT' } },
        },
      ],
    },
  ];
}

/** A `start`, as a replay or a genuine turn sends it. */
const start: ChatStreamEntry = { chunks: [{ type: 'start', messageId: 'stream-1' }] };

/** A bare slice of text, as a replay resumes past its turn's start. */
const delta = (text: string): ChatStreamEntry => ({ chunks: [{ type: 'text-delta', id: 't1', delta: text }] });

/**
 * `apply` BATCHES body deltas into an animation frame (`createDeltaBatcher`) —
 * only non-delta entries and `mutate` force a flush. Reading the store straight
 * after an `apply` therefore sees the pre-delta thread; wait a frame first.
 */
function flushDeltas(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function textOf(message: ChatMessage | undefined): string {
  return message ? textOfParts(message.parts) : '';
}

describe('history hydration → reducer', () => {
  it('APPENDS a delta that arrives with no preceding start', async () => {
    // The mid-stream reload shape: the turn opened server-side before this
    // client subscribed, so the catchup replay resumes PAST its MESSAGE_START
    // and the first chunk to land is a bare delta.
    const dialogId = 'dialog-append';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, hydratedThread());
    bindMingoDialog(dialogId).apply(delta(' Two endpoints online.'));
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
    // Per-message React memoization (and the history merge's reference reuse)
    // depends on an untouched message staying the SAME object.
    const dialogId = 'dialog-identity';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, hydratedThread());
    const before = useMingoMessagesStore.getState().getMessages(dialogId);

    bindMingoDialog(dialogId).apply(delta(' more'));
    await flushDeltas();

    const after = useMingoMessagesStore.getState().getMessages(dialogId);
    // The user bubble took no part in this entry — same object, not a clone.
    expect(after[0]).toBe(before[0]);
  });
});

describe('adopt-once', () => {
  it('lets a REPLAYED start re-stream into the unfinished bubble', async () => {
    // After a reload the catchup replay re-streams the turn from its
    // MESSAGE_START. Without the armed flag the reducer treats the hydrated
    // bubble as a completed one and opens a duplicate beside it — which is
    // what "the chunks start floating" looks like.
    const dialogId = 'dialog-adopt';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, unfinishedThread());
    const hydratedCount = useMingoMessagesStore.getState().getMessages(dialogId).length;

    bindMingoDialog(dialogId).apply(start);
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(messages).toHaveLength(hydratedCount);
    expect(textOf(messages.at(-1))).toContain("I'll kick this off in parallel.");
  });

  it('disarms on the first entry that is not a start', async () => {
    // The flag may not outlive the replay it was armed for: a later GENUINE
    // turn must open its own bubble instead of overwriting a finished one.
    const dialogId = 'dialog-disarm';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, unfinishedThread());
    const hydratedCount = useMingoMessagesStore.getState().getMessages(dialogId).length;

    // No replay came; something else lands first and burns the flag.
    bindMingoDialog(dialogId).apply(delta(' continuing.'));
    await flushDeltas();
    // Now a genuine new turn starts.
    bindMingoDialog(dialogId).apply(start);
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(messages).toHaveLength(hydratedCount + 1);
    expect(textOf(messages.at(-1))).toBe('');
  });

  it('disarms when the user resolves the approval the tail is waiting on', async () => {
    // A pending approval is an unfinished tail, so an idle refetch's hydrate
    // arms adoption while the agent sits blocked on the user. The user then
    // approves and the backend answers by STARTING a turn. Nothing guarantees
    // an APPROVAL_RESULT lands before that turn's MESSAGE_START, and a
    // still-armed flag would re-stream the continuation INTO the approval
    // bubble — card and preamble gone.
    const dialogId = 'dialog-disarm-approval';
    const store = useMingoMessagesStore.getState();

    store.setMessages(dialogId, pendingApprovalThread());
    const hydratedCount = useMingoMessagesStore.getState().getMessages(dialogId).length;

    store.updateApprovalStatusInMessages(dialogId, 'req-9', 'approved');
    bindMingoDialog(dialogId).apply(start);
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(messages).toHaveLength(hydratedCount + 1);
    expect(textOf(messages.at(-2))).toContain('This needs your go-ahead.');
    expect(textOf(messages.at(-1))).toBe('');
  });

  it('disarms on the ticket host too — both sides flip through the same mirror door', async () => {
    // Same hazard, other host: the ticket view resolves a client-side approval
    // (and rejects one on an interrupting send) through this store.
    const store = useTicketDetailsStore.getState();

    store.setMessages('client', pendingApprovalThread());
    const hydratedCount = useTicketDetailsStore.getState().getMessages('client').length;

    store.updateApprovalStatusInMessages('client', 'req-9', 'approved');
    bindTicketSide('client').apply(start);
    await flushDeltas();

    const messages = useTicketDetailsStore.getState().getMessages('client');
    expect(messages).toHaveLength(hydratedCount + 1);
    expect(textOf(messages.at(-2))).toContain('This needs your go-ahead.');
    expect(textOf(messages.at(-1))).toBe('');
  });
});

describe('hydration while a turn is open', () => {
  it('leaves a streaming turn its bubble: the next delta extends the live bubble only', async () => {
    // A history merge landing mid-turn appends the live bubble after the newest
    // persisted turn. The trailing assistant run then spans both, and while a
    // tool runs it reads as unfinished: adopting from it would rewrite the live
    // bubble as the persisted turn plus the streaming one.
    const dialogId = 'dialog-open-turn';
    const store = useMingoMessagesStore.getState();
    store.setMessages(dialogId, hydratedThread());
    const bound = bindMingoDialog(dialogId);
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Live answer.', streamSeq: 2 },
      {
        type: 'EXECUTING_TOOL',
        integratedToolType: 'OPENFRAME',
        toolFunction: 'run_script',
        toolExecutionRequestId: 'req-live',
        streamSeq: 3,
      },
    ]) {
      bound.apply(bound.decode(chunk));
    }
    await flushDeltas();

    store.setMessages(dialogId, useMingoMessagesStore.getState().getMessages(dialogId));
    bound.apply(bound.decode({ type: 'TEXT', text: ' More.', streamSeq: 4 }));
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(textOf(messages.at(-1))).not.toContain("I'll kick this off in parallel.");
    expect(textOf(messages.at(-1))).toContain(' More.');
    expect(textOf(messages.at(-2))).toBe("I'll kick this off in parallel.");
  });

  it('still seeds and arms a second hydrate of an agent-busy tail with no turn open', async () => {
    // The first hydrate raises 'thinking' off the busy tail; the cached pages
    // and then the fresh ones hydrate twice before the replay arrives. Treating
    // "not idle" as "turn open" disarmed adoption on the second, and the
    // replayed start opened a duplicate bubble.
    const dialogId = 'dialog-busy-twice';
    const store = useMingoMessagesStore.getState();
    store.setMessages(dialogId, unfinishedThread());
    store.setMessages(dialogId, unfinishedThread());
    const hydratedCount = useMingoMessagesStore.getState().getMessages(dialogId).length;

    bindMingoDialog(dialogId).apply(start);
    await flushDeltas();

    const messages = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(messages).toHaveLength(hydratedCount);
    expect(textOf(messages.at(-1))).toContain("I'll kick this off in parallel.");
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
      identityFor: key => ({ dialogId: key, side: DEFAULT_DIALOG_SIDE }),
      options: () => ({}),
      onSnapshot: (key, snapshot) => {
        snapshots.set(key, snapshot);
      },
    });

    // A FINISHED thread on purpose: hydrating an unfinished one raises the
    // phase to 'thinking' (the agent is still working), and the store never
    // evicts a reducer whose phase is not 'idle' — so this test would be
    // asserting against a key that cannot be dropped in the first place.
    mirror.hydrate('a', hydratedThread());
    // A key handed out by `getReducer` is protected from eviction until its
    // FIRST retain lands (the store stands in for the retain a rendering host
    // has not committed yet). Retain then release to reach the state a real
    // host is in once its panel unmounts: known, but no longer pinned.
    mirror.setActiveKeys(['a']);
    mirror.setActiveKeys([]);
    const epochBefore = mirror.bind('a').evictionEpoch;

    // Touch a second key — 'a' is now the LRU entry and gets dropped.
    mirror.hydrate('b', [userRow('u2', 'unrelated')]);

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

describe('activity indicator after hydration', () => {
  it('reports the agent as busy when a tool was left mid-flight', () => {
    // A reload during a tool run: the EXECUTING chunk is long past and the
    // EXECUTED one may be minutes away, so nothing on the wire would restore
    // the phase. Hosts render their spinner off it — an idle phase here shows
    // a dead-looking thread while the agent is still working.
    const dialogId = 'dialog-busy';
    useMingoMessagesStore.getState().setMessages(dialogId, unfinishedThread());

    expect(useMingoMessagesStore.getState().phaseByDialog.get(dialogId)).toBe('thinking');
    expect(useMingoMessagesStore.getState().getTyping(dialogId)).toBe(true);
  });

  it('reports busy for an APPROVED batch whose commands are still running', () => {
    // The operator approves, then reloads (or leaves and re-enters the dialog).
    // Nothing on the wire says the commands are running, so the indicator has to
    // come from the rows' own state, or the thread renders as if nothing were
    // happening while commands execute.
    const dialogId = 'dialog-approved-batch';
    const row = (toolCallId: string): ChatToolPart => ({
      type: 'dynamic-tool',
      toolName: 'run_script',
      toolCallId,
      state: 'approval-responded',
      input: {},
      approval: { id: toolCallId, approved: true, descriptor: { batchId: 'req-3' } },
    });
    useMingoMessagesStore
      .getState()
      .setMessages(dialogId, [
        userRow('u1', 'check the disks'),
        { id: 'a1', role: 'assistant', parts: [row('exec-1'), row('exec-2')] },
      ]);

    expect(useMingoMessagesStore.getState().getTyping(dialogId)).toBe(true);
  });

  it('stays idle when the turn is merely awaiting an approval', () => {
    // The opposite state: the agent is blocked on the USER. Spinning here
    // would claim work that is not happening.
    const dialogId = 'dialog-approval-idle';
    useMingoMessagesStore.getState().setMessages(dialogId, pendingApprovalThread());

    expect(useMingoMessagesStore.getState().getTyping(dialogId)).toBe(false);
  });
});

describe('a Mingo chunk, from the wire to the parts', () => {
  it('decodes a whole turn into the one message it draws', async () => {
    const dialogId = 'dialog-chunks';
    const bound = bindMingoDialog(dialogId);
    const chunks = [
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'Priced per ' },
      { type: 'TEXT', text: 'device.' },
      {
        type: 'ATTACHMENTS',
        sources: [
          {
            type: 'source-url',
            sourceId: 'record://blog_post/1108',
            url: 'https://www.flamingo.run/blog/openframe-vs-atera',
            title: 'OpenFrame vs Atera',
          },
        ],
      },
      { type: 'RECORD_CARDS', records: ['record://blog_post/1108'] },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'ar-1',
        approvalType: 'ADMIN',
        toolCalls: [
          {
            toolExecutionRequestId: 'run-1',
            toolName: 'run_script',
            toolTitle: 'Run script',
            requiresApproval: true,
            approvalType: 'ADMIN',
            toolCallArguments: { script: 'whoami' },
          },
        ],
      },
      { type: 'MESSAGE_END' },
    ];
    for (const [index, chunk] of chunks.entries()) bound.apply(bound.decode({ ...chunk, streamSeq: index + 1 }));
    await flushDeltas();

    const [message, ...rest] = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(rest).toEqual([]);
    expect(message.role).toBe('assistant');
    expect(message.parts).toEqual([
      {
        type: 'source-url',
        sourceId: 'record://blog_post/1108',
        url: 'https://www.flamingo.run/blog/openframe-vs-atera',
        title: 'OpenFrame vs Atera',
      },
      { type: 'text', text: 'Priced per device.', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
      {
        type: 'dynamic-tool',
        toolName: 'run_script',
        toolCallId: 'run-1',
        title: 'Run script',
        state: 'approval-requested',
        input: { script: 'whoami' },
        approval: { id: 'run-1', descriptor: { approvalType: 'ADMIN', batchId: 'ar-1' } },
      },
    ]);
  });

  it('flips a whole batch when the store resolves it by the request id the backend knows', () => {
    const dialogId = 'dialog-batch';
    const store = useMingoMessagesStore.getState();
    const bound = bindMingoDialog(dialogId);
    bound.apply(
      bound.decode({
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'ar-2',
        approvalType: 'ADMIN',
        streamSeq: 1,
        toolCalls: ['run-1', 'run-2'].map(toolExecutionRequestId => ({
          toolExecutionRequestId,
          toolName: 'run_script',
          requiresApproval: true,
        })),
      }),
    );

    store.updateApprovalStatusInMessages(dialogId, 'ar-2', 'rejected');

    const [message] = useMingoMessagesStore.getState().getMessages(dialogId);
    expect(message.parts.filter(isToolPart).map(part => part.state)).toEqual(['output-denied', 'output-denied']);
  });
});

describe("a key's decoder lives as long as its reducer's sequence", () => {
  it('answers a redelivery with nothing, so it cannot flush or repeat what the reducer has', () => {
    const bound = bindMingoDialog('dialog-redelivery');
    bound.apply(bound.decode({ type: 'TEXT', text: 'Hello', streamSeq: 7 }));

    expect(bound.decode({ type: 'TEXT', text: 'Hello', streamSeq: 7 }).chunks).toEqual([]);
  });

  it('starts over when the key is dropped: the same sequence reads again on the new reducer', async () => {
    const dialogId = 'dialog-dropped';
    const before = bindMingoDialog(dialogId);
    before.apply(before.decode({ type: 'TEXT', text: 'First life.', streamSeq: 7 }));
    await flushDeltas();

    useMingoMessagesStore.getState().clearDialog(dialogId);

    // Both handles reach the one decoder of the key, also one a subscription still holds.
    const replay = { type: 'TEXT', text: 'Second life.', streamSeq: 7 };
    expect(before.decode(replay).chunks.length).toBeGreaterThan(0);
    const after = bindMingoDialog(dialogId);
    expect(after.decode(replay).chunks).toEqual([]);
  });

  it('survives an LRU eviction: the sequence is parked with the thread, and a redelivery stays dropped', () => {
    const mirror = createReducerMirror<string>({
      createStore: storeOptions => createChatDialogStore({ ...storeOptions, maxReducers: 1 }),
      identityFor: key => ({ dialogId: key, side: DEFAULT_DIALOG_SIDE }),
      options: () => ({}),
      onSnapshot: () => {},
    });
    const seed = (key: string) => {
      const bound = mirror.bind(key);
      bound.apply(bound.decode({ type: 'MESSAGE_START', streamSeq: 1 }));
      bound.apply(bound.decode({ type: 'MESSAGE_END', streamSeq: 2 }));
    };
    seed('a');
    mirror.setActiveKeys(['a']);
    mirror.setActiveKeys([]);
    seed('b');

    expect(mirror.bind('a').decode({ type: 'MESSAGE_END', streamSeq: 2 }).chunks).toEqual([]);
  });
});
