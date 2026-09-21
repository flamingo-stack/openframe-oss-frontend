// Remote session chat service (CU-86ajx041x).
//
// Backs the technician's session chat panel while the BE dialog provisioning
// (CU-86ajx0359) and the session lifecycle events (CU-86ajx02qj) are in
// design. The real implementation talks to the dialogs API on `/chat/graphql`
// for history + send and to NATS `chat.<dialogId>.message` for live delivery
// (pattern: tickets/components/ticket-dialog-subscription.tsx); swapping is
// one new implementation of `IRemoteSessionChatService`.

import type { RemoteSessionChatMessage, RemoteSessionChatTechnician } from '../types/remote-session-chat';

export interface IRemoteSessionChatService {
  /** Messages already in the dialog, oldest first. */
  history(dialogId: string): Promise<RemoteSessionChatMessage[]>;
  /** Sends the technician's message; the stored message is also delivered to subscribers. */
  send(dialogId: string, body: string, technician: RemoteSessionChatTechnician): Promise<RemoteSessionChatMessage>;
  /** Live delivery of every message appended to the dialog (own ones included). */
  subscribe(dialogId: string, listener: (message: RemoteSessionChatMessage) => void): () => void;
}

const MOCK_LATENCY_MS = 200;
/** The scripted end user answers this long after a technician message. */
const MOCK_REPLY_DELAY_MS = 2_000;
/** The end user has no profile on the wire - the design shows a plain "User". */
export const REMOTE_SESSION_END_USER_NAME = 'User';

/** The end user's scripted replies, cycled per dialog. */
const MOCK_USER_REPLIES = [
  'Computer work slow',
  'Since this morning. Everything freezes when I open Excel',
  'Yes, go ahead',
  'Ok, thanks!',
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface MockDialog {
  messages: RemoteSessionChatMessage[];
  listeners: Set<(message: RemoteSessionChatMessage) => void>;
  replyIndex: number;
  timers: ReturnType<typeof setTimeout>[];
}

/**
 * In-memory mock. Dialogs live for the SPA session; every technician message
 * gets a scripted end-user reply a moment later so the panel can be exercised
 * end to end, and `simulateUserReply` lets the QA tooling inject one on
 * demand.
 */
class MockRemoteSessionChatService implements IRemoteSessionChatService {
  private readonly dialogs = new Map<string, MockDialog>();
  private seq = 0;

  async history(dialogId: string): Promise<RemoteSessionChatMessage[]> {
    await delay(MOCK_LATENCY_MS);
    return [...this.dialog(dialogId).messages];
  }

  async send(
    dialogId: string,
    body: string,
    technician: RemoteSessionChatTechnician,
  ): Promise<RemoteSessionChatMessage> {
    await delay(MOCK_LATENCY_MS);
    const message = this.append(dialogId, 'technician', technician.name, body);
    const dialog = this.dialog(dialogId);
    dialog.timers.push(setTimeout(() => this.replyFromUser(dialogId), MOCK_REPLY_DELAY_MS));
    return message;
  }

  subscribe(dialogId: string, listener: (message: RemoteSessionChatMessage) => void): () => void {
    const dialog = this.dialog(dialogId);
    dialog.listeners.add(listener);
    return () => {
      dialog.listeners.delete(listener);
    };
  }

  /** QA lever: the end user sends `body` (or the next scripted reply) now. */
  simulateUserReply(dialogId: string, body?: string): RemoteSessionChatMessage {
    return this.replyFromUser(dialogId, body);
  }

  /** Test helper - drops every dialog and pending scripted reply. */
  reset(): void {
    for (const dialog of this.dialogs.values()) {
      for (const timer of dialog.timers) clearTimeout(timer);
    }
    this.dialogs.clear();
  }

  private replyFromUser(dialogId: string, body?: string): RemoteSessionChatMessage {
    const dialog = this.dialog(dialogId);
    const text = body ?? MOCK_USER_REPLIES[dialog.replyIndex % MOCK_USER_REPLIES.length];
    if (body === undefined) dialog.replyIndex++;
    return this.append(dialogId, 'user', REMOTE_SESSION_END_USER_NAME, text);
  }

  private append(
    dialogId: string,
    author: RemoteSessionChatMessage['author'],
    authorName: string,
    body: string,
  ): RemoteSessionChatMessage {
    const dialog = this.dialog(dialogId);
    const message: RemoteSessionChatMessage = {
      id: `msg-${++this.seq}`,
      author,
      authorName,
      sentAt: new Date().toISOString(),
      body,
    };
    dialog.messages.push(message);
    for (const listener of dialog.listeners) listener(message);
    return message;
  }

  private dialog(dialogId: string): MockDialog {
    let dialog = this.dialogs.get(dialogId);
    if (!dialog) {
      dialog = { messages: [], listeners: new Set(), replyIndex: 0, timers: [] };
      this.dialogs.set(dialogId, dialog);
    }
    return dialog;
  }
}

export const mockRemoteSessionChatService = new MockRemoteSessionChatService();

export const remoteSessionChatService: IRemoteSessionChatService = mockRemoteSessionChatService;

/** True while the panel runs on the mock - drives the QA "simulate" lever. */
export const REMOTE_SESSION_CHAT_MOCK_ACTIVE = remoteSessionChatService instanceof MockRemoteSessionChatService;

/** No-op once the real service is wired - the lever only exists for the mock. */
export function simulateRemoteSessionUserReply(dialogId: string, body?: string): void {
  if (remoteSessionChatService instanceof MockRemoteSessionChatService) {
    remoteSessionChatService.simulateUserReply(dialogId, body);
  }
}
