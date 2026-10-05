// Remote session chat service surface; the dialog is served by
// remote-session-chat-api-service.ts.

import type { RemoteSessionChatMessage } from '../types/remote-session-chat';

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
  send(dialogId: string, body: string): Promise<void>;
}
