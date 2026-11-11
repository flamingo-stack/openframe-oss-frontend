/**
 * The Open Chat marker's source: an end-user message that arrives on the live
 * feed while the panel is closed. The history the page opens with, the
 * technician's own lines and anything that comes in with the panel open never
 * raise it; opening (or closing) the panel clears it. A live line of the
 * technician's that carries no name is named after the session's host when
 * the page passes one (a colleague watching), else after the signed-in one.
 * While the feed is not up, the history page is read again every 10 s.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSessionChatMessage, RemoteSessionChatTechnician } from '../types/remote-session-chat';
import { HISTORY_FALLBACK_MS, type RemoteSessionChatState, useRemoteSessionChat } from './use-remote-session-chat';

const feed = vi.hoisted(() => ({
  onEvent: null as ((payload: unknown) => void) | null,
  history: vi.fn(),
  /** Who the decoder was told the technician is. */
  decodedWith: undefined as RemoteSessionChatTechnician | undefined,
  /** Whether the dialog's consumer is up. */
  subscribed: true,
  /** The session-health gate for background requests. */
  pollsAllowed: true,
}));

vi.mock('@flamingo-stack/openframe-frontend-core', () => ({
  useJetStreamDialogSubscription: (options: { onEvent: (payload: unknown) => void }) => {
    feed.onEvent = options.onEvent;
    return { caughtUpCount: 0, isSubscribed: feed.subscribed };
  },
}));
vi.mock('@/lib/session-poll', () => ({ sessionPollsAllowed: () => feed.pollsAllowed }));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'ws://test', onBeforeReconnect: undefined }),
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: null }) => unknown) => select({ user: null }),
}));
vi.mock('../components/remote-access/remote-access-session-context', () => ({
  useRemoteAccessSession: () => ({ session: null }),
}));
vi.mock('../services/remote-session-chat-api-service', () => ({
  // The test feeds already-decoded rows through the feed.
  decodeRemoteSessionChatChunk: (payload: unknown, technician?: RemoteSessionChatTechnician) => {
    feed.decodedWith = technician;
    return payload as RemoteSessionChatMessage;
  },
  remoteSessionChatApiService: { history: feed.history, send: vi.fn() },
}));

function row(id: number, author: RemoteSessionChatMessage['author']): RemoteSessionChatMessage {
  return { id: `seq-${id}`, author, authorName: author === 'user' ? 'User' : 'Tech', sentAt: '', body: 'hi', seq: id };
}

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
}

const deliver = (message: RemoteSessionChatMessage) => act(() => feed.onEvent?.(message));
const unread = () => state.chat?.hasUnread;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  feed.onEvent = null;
  feed.decodedWith = undefined;
  feed.subscribed = true;
  feed.pollsAllowed = true;
  // The page the panel opens with: an older end-user line, already seen.
  feed.history.mockReset().mockResolvedValue({ messages: [row(1, 'user')], lastSeq: 1 });
  root = createRoot(document.createElement('div'));
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useRemoteSessionChat unread marker', () => {
  it('stays off for the history the page opens with', async () => {
    await mount();
    expect(state.chat?.messages).toHaveLength(1);
    expect(unread()).toBe(false);
  });

  it('turns on for an end-user message with the panel closed, and off once read', async () => {
    await mount();
    deliver(row(2, 'user'));
    expect(unread()).toBe(true);
    act(() => state.chat?.markRead());
    expect(unread()).toBe(false);
  });

  it("stays off for the technician's own lines", async () => {
    await mount();
    deliver(row(2, 'technician'));
    expect(unread()).toBe(false);
  });

  it('stays off for messages that arrive with the panel open, also after it closes', async () => {
    await mount(true);
    deliver(row(2, 'user'));
    await mount(false);
    expect(unread()).toBe(false);
  });
});

describe("useRemoteSessionChat technician's lines", () => {
  const HOST = { name: 'Roman Smith', avatarUrl: 'https://tenant/api/images/user/tech-roman?v=1' };

  it('names them after the host the page passes, not the signed-in watcher', async () => {
    await mount(true, HOST);
    deliver(row(2, 'technician'));
    expect(feed.decodedWith).toEqual(HOST);
    expect(state.chat?.technician).toEqual(HOST);
  });

  it('names them after the signed-in technician without a host', async () => {
    await mount(true);
    deliver(row(2, 'technician'));
    expect(feed.decodedWith?.name).toBe('Technician');
    expect(state.chat?.technician.name).toBe('Technician');
  });
});

describe('useRemoteSessionChat while the feed is down', () => {
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };
  const tick = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
      await settle();
    });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the history page again every 10 s, and stops once the feed is in', async () => {
    feed.subscribed = false;
    await mount(true);
    expect(feed.history).toHaveBeenCalledTimes(1);

    feed.history.mockResolvedValue({ messages: [row(1, 'user'), row(2, 'technician')], lastSeq: 2 });
    await tick(HISTORY_FALLBACK_MS);
    expect(feed.history).toHaveBeenCalledTimes(2);
    expect(state.chat?.messages.map(message => message.id)).toEqual(['seq-1', 'seq-2']);

    feed.subscribed = true;
    await mount(true);
    await tick(HISTORY_FALLBACK_MS * 3);
    expect(feed.history).toHaveBeenCalledTimes(2);
  });

  it('reads nothing more while the feed is up', async () => {
    await mount(true);
    await tick(HISTORY_FALLBACK_MS * 3);
    expect(feed.history).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while the session is paused', async () => {
    feed.subscribed = false;
    feed.pollsAllowed = false;
    await mount(true);
    await tick(HISTORY_FALLBACK_MS * 3);
    expect(feed.history).toHaveBeenCalledTimes(1);
  });
});
