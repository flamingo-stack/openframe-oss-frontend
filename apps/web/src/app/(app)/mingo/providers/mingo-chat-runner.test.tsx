/**
 * What the runner's mount and unmount do to the chat's sequence. `store.reset()` empties the snapshot it publishes to the
 * surfaces; the reducers and their decoders live in the module-level mirror, so the live tail a new mount opens carries on
 * where the last one stopped. A reducer's sequence restarts only when the messages store drops its dialog, and the
 * dialog's decoder goes with it.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindMingoDialog, useMingoMessagesStore } from '../stores/mingo-messages-store';
import { fakeChatProbe, makeFakeChat, resetFakeChatProbe } from './__tests__/fake-mingo-chat';
import { MingoChatRunner } from './mingo-chat-runner';
import { createMingoChatStore, IDLE_MINGO_CHAT } from './mingo-chat-store';

const DIALOG = 'dialog-runner';

vi.mock('../hooks/use-mingo-unified-chat-state', async () => ({
  useMingoUnifiedChatState: (await import('./__tests__/fake-mingo-chat')).useFakeMingoUnifiedChatState,
}));
vi.mock('../hooks/use-mingo-realtime-subscription', async () => ({
  DialogSubscription: (await import('./__tests__/fake-mingo-chat')).FakeDialogSubscription,
}));
vi.mock('../hooks/use-mingo-dialog-selection', () => ({ MINGO_DIALOG_NOT_FOUND: 'MINGO_DIALOG_NOT_FOUND' }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const textOfThread = () =>
  (useMingoMessagesStore.getState().messagesByDialog.get(DIALOG) ?? [])
    .flatMap(message => message.parts)
    .map(part => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('');

function feed(raw: Record<string, unknown>) {
  const bound = bindMingoDialog(DIALOG);
  act(() => {
    bound.apply(bound.decode(raw));
    // A delta is batched into a frame; `mutate` lands the batch.
    bound.mutate(() => undefined);
  });
}

function mountRunner(store: ReturnType<typeof createMingoChatStore>) {
  const root = createRoot(document.createElement('div'));
  act(() => {
    root.render(<MingoChatRunner store={store} onScreen />);
  });
  return root;
}

beforeEach(() => {
  resetFakeChatProbe(makeFakeChat({ activeDialogId: DIALOG }));
  useMingoMessagesStore.getState().resetAll();
});

afterEach(() => {
  useMingoMessagesStore.getState().resetAll();
});

describe('MingoChatRunner', () => {
  it("the publish store's reset leaves the reducer and its decoder: a new mount's tail carries on", () => {
    const store = createMingoChatStore();
    const root = mountRunner(store);
    expect(store.getSnapshot().chat).not.toBeNull();
    expect(fakeChatProbe.liveTails).toEqual([DIALOG]);

    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'Half an ', streamSeq: 2 });
    act(() => root.unmount());
    expect(store.getSnapshot()).toBe(IDLE_MINGO_CHAT);
    expect(fakeChatProbe.liveTails).toEqual([]);

    const again = mountRunner(store);
    expect(fakeChatProbe.liveTails).toEqual([DIALOG]);
    // The new subscription redelivers from where the cursor stands, and nothing is repeated.
    expect(bindMingoDialog(DIALOG).decode({ type: 'TEXT', text: 'Half an ', streamSeq: 2 }).chunks).toEqual([]);
    feed({ type: 'TEXT', text: 'answer.', streamSeq: 3 });
    expect(textOfThread()).toBe('Half an answer.');
    act(() => again.unmount());
  });

  it("a dropped dialog's reducer starts over, and so does its decoder: the same chunks read again", () => {
    const store = createMingoChatStore();
    const root = mountRunner(store);
    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'From the stream.', streamSeq: 2 });
    expect(textOfThread()).toBe('From the stream.');

    act(() => useMingoMessagesStore.getState().clearDialog(DIALOG));
    expect(textOfThread()).toBe('');

    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'From the stream.', streamSeq: 2 });
    expect(textOfThread()).toBe('From the stream.');
    act(() => root.unmount());
  });
});
