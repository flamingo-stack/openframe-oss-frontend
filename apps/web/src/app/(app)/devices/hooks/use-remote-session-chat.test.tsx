/**
 * The Open Chat marker's source: an end-user message that arrives on the live
 * feed while the panel is closed. The history the page opens with, the
 * technician's own lines and anything that comes in with the panel open never
 * raise it; opening (or closing) the panel clears it.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSessionChatMessage } from '../types/remote-session-chat';
import { type RemoteSessionChatState, useRemoteSessionChat } from './use-remote-session-chat';

const feed = vi.hoisted(() => ({
  onEvent: null as ((payload: unknown) => void) | null,
  history: vi.fn(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core', () => ({
  useJetStreamDialogSubscription: (options: { onEvent: (payload: unknown) => void }) => {
    feed.onEvent = options.onEvent;
    return { caughtUpCount: 0 };
  },
}));
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
  decodeRemoteSessionChatChunk: (payload: unknown) => payload as RemoteSessionChatMessage,
  remoteSessionChatApiService: { history: feed.history, send: vi.fn() },
}));

function row(id: number, author: RemoteSessionChatMessage['author']): RemoteSessionChatMessage {
  return { id: `seq-${id}`, author, authorName: author === 'user' ? 'User' : 'Tech', sentAt: '', body: 'hi', seq: id };
}

const state: { chat: RemoteSessionChatState | null } = { chat: null };

function Probe({ panelOpen }: { panelOpen: boolean }) {
  const chat = useRemoteSessionChat('dialog-1', panelOpen);
  useEffect(() => {
    state.chat = chat;
  });
  return null;
}

let root: Root;

async function mount(panelOpen = false) {
  await act(async () => {
    root.render(<Probe panelOpen={panelOpen} />);
    await Promise.resolve();
  });
}

const deliver = (message: RemoteSessionChatMessage) => act(() => feed.onEvent?.(message));
const unread = () => state.chat?.hasUnread;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  feed.onEvent = null;
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
