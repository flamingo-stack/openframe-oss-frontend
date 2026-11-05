/**
 * What the runner's mount and unmount do to the chat's sequence. `store.reset()` empties the snapshot it publishes to the
 * surfaces; the threads, their reducers and their decoders live in the module-level `mingoThreadStore`, so the live tail
 * a new mount opens carries on where the last one stopped. A dialog's sequence restarts only when the thread store drops
 * it, and the dialog's decoder goes with it.
 */
import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mingoThreadStore } from '../stores/mingo-thread-store';
import { fakeChatProbe, makeFakeChat, resetFakeChatProbe } from './__tests__/fake-mingo-chat';
import { MingoChatRunner } from './mingo-chat-runner';
import { createMingoChatStore, IDLE_MINGO_CHAT } from './mingo-chat-store';

const DIALOG = 'dialog-runner';

vi.mock('../hooks/use-mingo-unified-chat-state', async () => ({
  useMingoUnifiedChatState: (await import('./__tests__/fake-mingo-chat')).useFakeMingoUnifiedChatState,
}));
vi.mock('@/lib/active-dialog-views', async () => ({
  registerActiveDialogView: (await import('./__tests__/fake-mingo-chat')).fakeRegisterActiveDialogView,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const textOfThread = () =>
  mingoThreadStore
    .snapshotOf(DIALOG)
    .messages.flatMap((message: ChatMessage) => message.parts)
    .map(part => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('');

function feed(raw: Record<string, unknown>) {
  const bound = mingoThreadStore.bind(DIALOG);
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
  mingoThreadStore.drop(DIALOG);
});

afterEach(() => {
  mingoThreadStore.drop(DIALOG);
});

describe('MingoChatRunner', () => {
  it("the publish store's reset leaves the thread and its decoder: a new mount's tail carries on", () => {
    const store = createMingoChatStore();
    const root = mountRunner(store);
    expect(store.getSnapshot().chat).not.toBeNull();
    expect(fakeChatProbe.mounted).toBe(1);
    expect(fakeChatProbe.onScreen).toEqual([DIALOG]);

    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'Half an ', streamSeq: 2 });
    act(() => root.unmount());
    expect(store.getSnapshot()).toBe(IDLE_MINGO_CHAT);
    expect(fakeChatProbe.mounted).toBe(0);
    expect(fakeChatProbe.onScreen).toEqual([]);

    const again = mountRunner(store);
    expect(fakeChatProbe.mounted).toBe(1);
    // The new tail redelivers from where the cursor stands, and nothing is repeated.
    expect(mingoThreadStore.bind(DIALOG).decode({ type: 'TEXT', text: 'Half an ', streamSeq: 2 }).chunks).toEqual([]);
    feed({ type: 'TEXT', text: 'answer.', streamSeq: 3 });
    expect(textOfThread()).toBe('Half an answer.');
    act(() => again.unmount());
  });

  it("a dropped dialog's thread starts over, and so does its decoder: the same chunks read again", () => {
    const store = createMingoChatStore();
    const root = mountRunner(store);
    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'From the stream.', streamSeq: 2 });
    expect(textOfThread()).toBe('From the stream.');

    act(() => mingoThreadStore.drop(DIALOG));
    expect(textOfThread()).toBe('');

    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'From the stream.', streamSeq: 2 });
    expect(textOfThread()).toBe('From the stream.');
    act(() => root.unmount());
  });

  it('counts the open dialog as on screen only while the page says so', () => {
    const store = createMingoChatStore();
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<MingoChatRunner store={store} onScreen={false} />));
    expect(fakeChatProbe.onScreen).toEqual([]);
    act(() => root.render(<MingoChatRunner store={store} onScreen />));
    expect(fakeChatProbe.onScreen).toEqual([DIALOG]);
    act(() => root.unmount());
  });
});
