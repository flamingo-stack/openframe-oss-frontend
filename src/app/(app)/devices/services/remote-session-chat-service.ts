// Remote session chat service.
//
// Backs the technician's session chat panel until the backend provisions a
// dialog per session. The real implementation talks to the dialogs API on
// `/chat/graphql` for history + send and to NATS `chat.<dialogId>.message` for
// live delivery (pattern: tickets/components/ticket-dialog-subscription.tsx);
// swapping is one new implementation of `IRemoteSessionChatService`.

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
/** The end user has no profile on the wire - the design shows a plain "User". */
export const REMOTE_SESSION_END_USER_NAME = 'User';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface MockDialog {
  messages: RemoteSessionChatMessage[];
  listeners: Set<(message: RemoteSessionChatMessage) => void>;
}

/**
 * In-memory mock. Dialogs live for the SPA session and hold exactly what was
 * sent into them: nothing answers on the end user's behalf, so the panel shows
 * the technician's own lines until the real dialog is wired. Tests inject the
 * end user's side through `simulateUserReply`.
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
    return this.append(dialogId, 'technician', technician.name, body);
  }

  subscribe(dialogId: string, listener: (message: RemoteSessionChatMessage) => void): () => void {
    const dialog = this.dialog(dialogId);
    dialog.listeners.add(listener);
    return () => {
      dialog.listeners.delete(listener);
    };
  }

  /** Test helper - the end user sends `body` now. */
  simulateUserReply(dialogId: string, body: string): RemoteSessionChatMessage {
    return this.append(dialogId, 'user', REMOTE_SESSION_END_USER_NAME, body);
  }

  /** Test helper - drops every dialog. */
  reset(): void {
    this.dialogs.clear();
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
      dialog = { messages: [], listeners: new Set() };
      this.dialogs.set(dialogId, dialog);
    }
    return dialog;
  }
}

export const mockRemoteSessionChatService = new MockRemoteSessionChatService();

export const remoteSessionChatService: IRemoteSessionChatService = mockRemoteSessionChatService;
