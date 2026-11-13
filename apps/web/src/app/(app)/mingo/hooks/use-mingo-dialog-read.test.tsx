/**
 * When the open Mingo chat is marked read, and when it is not: on screen and owned by the user, once per on-screen
 * period and once per reply that ends there, with a person present. A reply that ends behind a page is read back
 * instead, so its row shows it.
 */

import type { MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextMingoRowsTick, noteMingoDialogResponse, useMingoDialogRowsStore } from '../stores/mingo-dialog-rows-store';
import { isOwnMingoDialog, useMingoDialogAutoRead } from './use-mingo-dialog-read';

const mocks = vi.hoisted(() => ({
  markDialogMessagesRead: vi.fn<(id: string) => Promise<number>>(),
  present: true,
  attentionListeners: new Set<() => void>(),
}));

vi.mock('../../tickets/services', () => ({
  ticketService: { markDialogMessagesRead: mocks.markDialogMessagesRead },
}));
vi.mock('@/lib/session-activity', () => ({
  PRESENCE_IDLE_MS: 300_000,
  isSessionActive: () => mocks.present,
  subscribeAttention: (listener: () => void) => {
    mocks.attentionListeners.add(listener);
    return () => mocks.attentionListeners.delete(listener);
  },
}));

const ME = 'u-1';

function chat(dialogId: string, fields: Partial<MingoDialogNode> = {}): MingoDialogNode {
  return {
    id: `global-${dialogId}`,
    dialogId,
    title: dialogId,
    status: 'ACTIVE',
    streamState: 'IDLE',
    createdAt: '2026-11-11T09:00:00Z',
    unreadMessageCount: 0,
    owner: { type: 'ADMIN', userId: ME },
    ...fields,
  };
}

/** A list page as the ai-agent answers it now: every row it carries is noted. */
function listed(...nodes: MingoDialogNode[]) {
  act(() => noteMingoDialogResponse({ dialogs: { edges: nodes.map(node => ({ node })) } }, nextMingoRowsTick()));
}

const unreadOf = (dialogId: string) => useMingoDialogRowsStore.getState().rows.get(dialogId)?.unread;

/** Let the mark-read's awaits run to the end. */
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

type Options = Parameters<typeof useMingoDialogAutoRead>[0];

const readDialogAgain = vi.fn<(dialogId: string) => Promise<unknown>>();

const base: Options = {
  dialogId: 'd-1',
  currentUserId: ME,
  onScreen: true,
  replyRunning: false,
  readDialogAgain,
};

let root: Root | null = null;

function Probe(options: Options) {
  useMingoDialogAutoRead(options);
  return null;
}

function mount(options: Partial<Options> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const render = (next: Partial<Options> = {}) =>
    act(() => {
      root?.render(<Probe {...base} {...next} />);
    });
  render(options);
  return { render };
}

beforeEach(() => {
  mocks.present = true;
  mocks.markDialogMessagesRead.mockReset().mockResolvedValue(0);
  readDialogAgain.mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  mocks.attentionListeners.clear();
  useMingoDialogRowsStore.setState({ rows: new Map(), missing: new Set() });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('isOwnMingoDialog', () => {
  it('is the chat the signed-in admin created', () => {
    expect(isOwnMingoDialog(ME, ME)).toBe(true);
    expect(isOwnMingoDialog('u-2', ME)).toBe(false);
  });

  it('is never a chat with no admin owner, or one seen before the user is known', () => {
    expect(isOwnMingoDialog(undefined, ME)).toBe(false);
    expect(isOwnMingoDialog(ME, undefined)).toBe(false);
    expect(isOwnMingoDialog(undefined, undefined)).toBe(false);
  });
});

describe('useMingoDialogAutoRead: a chat on screen', () => {
  it('marks my chat read once, by its Relay id, and zeroes its row', async () => {
    listed(chat('d-1', { unreadMessageCount: 2 }));
    const { render } = mount();
    await settle();

    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledWith('global-d-1');
    expect(unreadOf('d-1')).toBe(0);

    render();
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
  });

  it('waits for the chat to be known: a deep link marks once its record has answered', async () => {
    mount();
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();

    act(() => noteMingoDialogResponse({ dialog: chat('d-1', { unreadMessageCount: 1 }) }, nextMingoRowsTick()));
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledWith('global-d-1');
  });

  it('marks each chat as it is opened', async () => {
    listed(chat('d-1'), chat('d-2'));
    const { render } = mount();
    await settle();
    render({ dialogId: 'd-2' });
    await settle();
    expect(mocks.markDialogMessagesRead.mock.calls.map(call => call[0])).toEqual(['global-d-1', 'global-d-2']);
  });

  it('marks again when a reply ends there', async () => {
    listed(chat('d-1'));
    const { render } = mount();
    await settle();
    render({ replyRunning: true });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
    render({ replyRunning: false });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for a chat someone else owns', async () => {
    listed(chat('d-1', { owner: { type: 'ADMIN', userId: 'u-2' }, unreadMessageCount: 0 }));
    const { render } = mount();
    render({ replyRunning: true });
    render({ replyRunning: false });
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
    expect(readDialogAgain).not.toHaveBeenCalled();
  });

  it('sends nothing while the owner or the user is not known', async () => {
    listed(chat('d-1', { owner: { type: 'CLIENT', machineId: 'm-1' } }));
    mount({ currentUserId: undefined });
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
  });
});

describe('useMingoDialogAutoRead: nobody at the desk', () => {
  it('owes the mark until attention returns', async () => {
    mocks.present = false;
    listed(chat('d-1', { unreadMessageCount: 1 }));
    mount();
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
    expect(unreadOf('d-1')).toBe(1);

    mocks.present = true;
    act(() => {
      for (const listener of mocks.attentionListeners) listener();
    });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
  });

  it('owes one mark for a reply that ended unattended, paid once', async () => {
    listed(chat('d-1'));
    const { render } = mount();
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    mocks.present = false;
    render({ replyRunning: true });
    render({ replyRunning: false });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    mocks.present = true;
    act(() => {
      for (const listener of mocks.attentionListeners) listener();
    });
    await settle();
    act(() => {
      for (const listener of mocks.attentionListeners) listener();
    });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
  });
});

describe('useMingoDialogAutoRead: the open chat behind a page', () => {
  it('marks nothing, and reads a reply that ended there back from the server', async () => {
    listed(chat('d-1'));
    const { render } = mount({ onScreen: false, replyRunning: true });
    await settle();
    render({ onScreen: false, replyRunning: false });
    await settle();

    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();
    expect(readDialogAgain).toHaveBeenCalledTimes(1);
    expect(readDialogAgain).toHaveBeenCalledWith('d-1');
  });

  it('marks it read when the chat is shown again', async () => {
    listed(chat('d-1', { unreadMessageCount: 1 }));
    const { render } = mount({ onScreen: false });
    await settle();
    expect(mocks.markDialogMessagesRead).not.toHaveBeenCalled();

    render({ onScreen: true });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);
    expect(unreadOf('d-1')).toBe(0);
  });

  it('leaves a failed read-back to the next list read', async () => {
    readDialogAgain.mockRejectedValue(new Error('offline'));
    listed(chat('d-1'));
    const { render } = mount({ onScreen: false, replyRunning: true });
    render({ onScreen: false, replyRunning: false });
    await settle();
    expect(readDialogAgain).toHaveBeenCalledTimes(1);
    expect(unreadOf('d-1')).toBe(0);
  });
});

describe('useMingoDialogAutoRead: the row around the mark', () => {
  it('is zeroed before the request answers, and a list read asked before it cannot bring the old count back', async () => {
    let answer: (count: number) => void = () => {};
    mocks.markDialogMessagesRead.mockReturnValue(new Promise<number>(resolve => (answer = resolve)));
    listed(chat('d-1', { unreadMessageCount: 2 }));
    const askedBefore = nextMingoRowsTick();
    mount();
    await settle();
    expect(unreadOf('d-1')).toBe(0);

    act(() =>
      noteMingoDialogResponse({ dialogs: { edges: [{ node: chat('d-1', { unreadMessageCount: 2 }) }] } }, askedBefore),
    );
    expect(unreadOf('d-1')).toBe(0);

    answer(0);
    await settle();
    expect(unreadOf('d-1')).toBe(0);
  });

  it("takes the request's answer as what is left to read", async () => {
    mocks.markDialogMessagesRead.mockResolvedValue(1);
    listed(chat('d-1', { unreadMessageCount: 2 }));
    mount();
    await settle();
    expect(unreadOf('d-1')).toBe(1);
  });

  it('says nothing when the mark is refused, and has the chat read again', async () => {
    mocks.markDialogMessagesRead.mockRejectedValue(new Error('refused'));
    listed(chat('d-1', { unreadMessageCount: 2 }));
    mount();
    await settle();
    expect(console.warn).toHaveBeenCalled();
    expect(readDialogAgain).toHaveBeenCalledWith('d-1');
  });

  it('runs once more for a reply that ended while a mark was in flight', async () => {
    let answer: (count: number) => void = () => {};
    mocks.markDialogMessagesRead.mockReturnValueOnce(new Promise<number>(resolve => (answer = resolve)));
    listed(chat('d-1'));
    const { render } = mount();
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    render({ replyRunning: true });
    render({ replyRunning: false });
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(1);

    answer(0);
    await settle();
    expect(mocks.markDialogMessagesRead).toHaveBeenCalledTimes(2);
  });
});
