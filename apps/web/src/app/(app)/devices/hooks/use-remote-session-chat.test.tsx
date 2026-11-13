/**
 * The remote session's chat on the lib's chat engine: the engine's thread drawn as the panel's lines, and the Open Chat
 * marker. Live chunks go through the engine's real decoder and reducers; only the tail, the history read and the send
 * are stood in for.
 *
 * The marker's source is an end-user line that arrives while the panel is closed. The history the page opens with, the
 * technician's own lines and anything that comes in with the panel open never raise it; opening (or closing) the panel
 * clears it. A technician's line that carries no name is named after the session's host when the page passes one (a
 * colleague watching), else after the signed-in one. Until the feed is subscribed, the history is read again every 10 s.
 */

import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSessionChatTechnician } from '../types/remote-session-chat';
import { HISTORY_FALLBACK_MS, type RemoteSessionChatState, useRemoteSessionChat } from './use-remote-session-chat';

const feed = vi.hoisted(() => ({
  onEvent: null as ((payload: unknown) => void) | null,
  history: vi.fn(),
  send: vi.fn(),
  /** The tail's report that it is subscribed to the dialog, once it is enabled. */
  subscribe: null as (() => void) | null,
  /** The session-health gate for background requests. */
  pollsAllowed: true,
}));

// The lib's engine runs for real; its JetStream tail and its GraphQL history are stood in for.
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  jetStreamLiveTail:
    () =>
    (options: {
      enabled: boolean;
      fromSeq: number | null | undefined;
      onEvent: (payload: unknown) => void;
      onSubscribed?: () => void;
    }) => {
      const up = options.enabled && options.fromSeq !== undefined;
      feed.onEvent = up ? options.onEvent : null;
      feed.subscribe = up ? (options.onSubscribed ?? null) : null;
    },
  createMingoGraphqlHistory: () => feed.history,
}));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-unified-chat-state', () => ({ postMingoGraphql: vi.fn() }));
vi.mock('@/app/(app)/tickets/services', () => ({ ticketService: { sendMessage: feed.send } }));
vi.mock('@/lib/session-poll', () => ({ sessionPollsAllowed: () => feed.pollsAllowed }));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'ws://test', onBeforeReconnect: undefined }),
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => {
  const user = { id: 'tech-1', firstName: 'Roman', lastName: 'K.', email: 'roman@example.com' };
  const useAuthStore = (select: (state: { user: typeof user }) => unknown) => select({ user });
  useAuthStore.getState = () => ({ user });
  return { useAuthStore };
});
vi.mock('../components/remote-access/remote-access-session-context', () => ({
  useRemoteAccessSession: () => ({ session: null }),
}));

/** A persisted end-user line, as the history page gives it to the engine. */
const historyLine: ChatMessage = {
  id: 'h-1',
  role: 'user',
  metadata: { createdAt: '2026-09-23T10:00:00Z', streamSeq: 1, author: { name: 'You', authorType: 'user' } },
  parts: [{ type: 'text', text: 'Earlier' }],
};

/** A live direct message on the dialog's subject. */
const direct = (seq: number, ownerType: 'CLIENT' | 'ADMIN', text: string, extra: Record<string, unknown> = {}) => ({
  type: 'DIRECT_MESSAGE',
  text,
  ownerType,
  streamSeq: seq,
  ...extra,
});

const state: { chat: RemoteSessionChatState | null } = { chat: null };

function Probe({ panelOpen, host }: { panelOpen: boolean; host?: RemoteSessionChatTechnician }) {
  const chat = useRemoteSessionChat('dialog-1', panelOpen, host);
  useEffect(() => {
    state.chat = chat;
  });
  return null;
}

let root: Root;

async function mount(panelOpen = false, host?: RemoteSessionChatTechnician) {
  await act(async () => {
    root.render(<Probe panelOpen={panelOpen} host={host} />);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const deliver = (payload: unknown) => act(() => feed.onEvent?.(payload));
const unread = () => state.chat?.hasUnread;
const lines = () => state.chat?.messages.map(line => [line.author, line.authorName, line.body]);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  feed.onEvent = null;
  feed.subscribe = null;
  feed.pollsAllowed = true;
  feed.history.mockReset().mockResolvedValue({ thread: [historyLine], nextCursor: null });
  feed.send.mockReset().mockResolvedValue(undefined);
  root = createRoot(document.createElement('div'));
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useRemoteSessionChat lines', () => {
  it("draws the history and the end user's live lines as the end user's, and drops system notices", async () => {
    await mount();
    deliver(direct(2, 'CLIENT', 'Hello'));
    deliver({ type: 'SYSTEM', text: 'joined the chat', streamSeq: 3 });
    expect(lines()).toEqual([
      ['user', 'User', 'Earlier'],
      ['user', 'User', 'Hello'],
    ]);
  });

  it('draws a line the tail delivers again once', async () => {
    await mount();
    deliver(direct(2, 'CLIENT', 'Hello'));
    deliver(direct(2, 'CLIENT', 'Hello'));
    expect(lines()).toHaveLength(2);
  });

  it("shows the technician's own send once: its echo closes the turn instead of drawing a second row", async () => {
    await mount();
    await act(async () => {
      expect(await state.chat?.send('  On it  ')).toBe(true);
    });
    expect(feed.send).toHaveBeenCalledWith('dialog-1', 'On it', 'CLIENT_CHAT');
    deliver(direct(2, 'ADMIN', 'On it', { userId: 'tech-1' }));
    expect(lines()).toEqual([
      ['user', 'User', 'Earlier'],
      ['technician', 'Roman K.', 'On it'],
    ]);
  });

  it("names another technician's line by its own name", async () => {
    await mount();
    deliver(direct(2, 'ADMIN', 'Joining', { userId: 'tech-2', displayName: 'Dana' }));
    expect(lines()?.at(-1)).toEqual(['technician', 'Dana', 'Joining']);
  });

  it('draws no line for a send that failed, so a retry is not drawn twice', async () => {
    feed.send.mockRejectedValueOnce(new Error('503'));
    await mount();
    await act(async () => {
      expect(await state.chat?.send('On it')).toBe(false);
    });
    expect(lines()).toEqual([['user', 'User', 'Earlier']]);

    await act(async () => {
      expect(await state.chat?.send('On it')).toBe(true);
    });
    expect(lines()).toEqual([
      ['user', 'User', 'Earlier'],
      ['technician', 'Roman K.', 'On it'],
    ]);
  });

  it('sends nothing blank', async () => {
    await mount();
    await act(async () => {
      expect(await state.chat?.send('   ')).toBe(false);
    });
    expect(feed.send).not.toHaveBeenCalled();
  });
});

describe('useRemoteSessionChat unread marker', () => {
  it('stays off for the history the page opens with', async () => {
    await mount();
    expect(state.chat?.messages).toHaveLength(1);
    expect(unread()).toBe(false);
  });

  it('turns on for an end-user message with the panel closed, and off once read', async () => {
    await mount();
    deliver(direct(2, 'CLIENT', 'Hello'));
    expect(unread()).toBe(true);
    act(() => state.chat?.markRead());
    expect(unread()).toBe(false);
  });

  it("stays off for the technician's own lines", async () => {
    await mount();
    deliver(direct(2, 'ADMIN', 'Hi', { userId: 'tech-2', displayName: 'Dana' }));
    expect(unread()).toBe(false);
  });

  it('stays off for messages that arrive with the panel open, also after it closes', async () => {
    await mount(true);
    deliver(direct(2, 'CLIENT', 'Hello'));
    await mount(false);
    expect(unread()).toBe(false);
  });
});

describe("useRemoteSessionChat technician's lines", () => {
  const HOST = { name: 'Roman Smith', avatarUrl: 'https://tenant/api/images/user/tech-roman?v=1' };

  it('names an unnamed one after the host the page passes, not the signed-in watcher', async () => {
    await mount(true, HOST);
    deliver(direct(2, 'ADMIN', 'On it', { userId: 'tech-roman' }));
    expect(lines()?.at(-1)).toEqual(['technician', 'Roman Smith', 'On it']);
    expect(state.chat?.technician).toEqual(HOST);
  });

  it('names an unnamed one after the signed-in technician without a host', async () => {
    await mount(true);
    deliver(direct(2, 'ADMIN', 'On it', { userId: 'tech-roman' }));
    expect(lines()?.at(-1)).toEqual(['technician', 'Roman K.', 'On it']);
    expect(state.chat?.technician.name).toBe('Roman K.');
  });
});

describe('useRemoteSessionChat until the feed is subscribed', () => {
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };
  const tick = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
      await settle();
    });
  const subscribe = () => act(() => feed.subscribe?.());

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the history again every 10 s, and stops once the feed is in', async () => {
    await mount(true);
    expect(feed.history).toHaveBeenCalledTimes(1);

    feed.history.mockResolvedValue({
      thread: [historyLine, { ...historyLine, id: 'h-2', metadata: { ...historyLine.metadata, streamSeq: 2 } }],
      nextCursor: null,
    });
    await tick(HISTORY_FALLBACK_MS);
    expect(feed.history).toHaveBeenCalledTimes(2);
    expect(lines()).toHaveLength(2);

    await subscribe();
    await tick(HISTORY_FALLBACK_MS * 3);
    expect(feed.history).toHaveBeenCalledTimes(2);
  });

  it('reads nothing more while the feed is up', async () => {
    await mount(true);
    await subscribe();
    await tick(HISTORY_FALLBACK_MS * 3);
    expect(feed.history).toHaveBeenCalledTimes(1);
  });

  // A re-read keeps only the latest page: what has been seen is a position in the dialog, not a count of lines.
  it("still marks the end user's next line unread after a re-read shortened the thread", async () => {
    const line = (seq: number): ChatMessage => ({
      ...historyLine,
      id: `h-${seq}`,
      metadata: { ...historyLine.metadata, streamSeq: seq },
    });
    feed.history.mockResolvedValue({ thread: [line(1), line(2), line(3)], nextCursor: null });
    await mount(false);
    expect(unread()).toBe(false);

    feed.history.mockResolvedValue({ thread: [line(3)], nextCursor: null });
    await tick(HISTORY_FALLBACK_MS);
    expect(lines()).toHaveLength(1);
    expect(unread()).toBe(false);

    deliver(direct(4, 'CLIENT', 'Are you there?'));
    expect(unread()).toBe(true);
  });

  it('sends nothing while the session is paused', async () => {
    feed.pollsAllowed = false;
    await mount(true);
    await tick(HISTORY_FALLBACK_MS * 3);
    expect(feed.history).toHaveBeenCalledTimes(1);
  });
});
