// Remote session chat service surface, and the in-memory stand-in used on the
// mock approval backend (no session record, no dialog). The real dialog is
// served by remote-session-chat-api-service.ts; the hook picks by dialog id.

import {
  REMOTE_SESSION_END_USER_NAME,
  type RemoteSessionChatMessage,
  type RemoteSessionChatTechnician,
} from '../types/remote-session-chat';

export interface RemoteSessionChatHistory {
  /** Oldest first. */
  messages: RemoteSessionChatMessage[];
  /** The highest JetStream sequence on the page; the live feed opens right after it. 0 = nothing stamped. */
  lastSeq: number;
}

export interface IRemoteSessionChatService {
  /** The messages already in the dialog. */
  history(dialogId: string): Promise<RemoteSessionChatHistory>;
  /** Sends the technician's message; it comes back through the dialog's feed like everything else. */
  send(dialogId: string, body: string, technician: RemoteSessionChatTechnician): Promise<void>;
}

/** Mock dialogs are named after the approved request; the real ones are backend ids. */
const MOCK_DIALOG_PREFIX = 'mock-dialog:';

export function mockRemoteSessionDialogId(requestId: string): string {
  return `${MOCK_DIALOG_PREFIX}${requestId}`;
}

export function isMockRemoteSessionDialog(dialogId: string | null): boolean {
  return dialogId !== null && dialogId.startsWith(MOCK_DIALOG_PREFIX);
}

const MOCK_LATENCY_MS = 200;

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
 * the technician's own lines until a real dialog exists. Tests inject the
 * end user's side through `simulateUserReply`.
 */
class MockRemoteSessionChatService implements IRemoteSessionChatService {
  private readonly dialogs = new Map<string, MockDialog>();
  private seq = 0;

  async history(dialogId: string): Promise<RemoteSessionChatHistory> {
    await delay(MOCK_LATENCY_MS);
    return { messages: [...this.dialog(dialogId).messages], lastSeq: 0 };
  }

  async send(dialogId: string, body: string, technician: RemoteSessionChatTechnician): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    this.append(dialogId, 'technician', technician.name, body);
  }

  /** Live delivery of every message appended to the dialog (own ones included). */
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
