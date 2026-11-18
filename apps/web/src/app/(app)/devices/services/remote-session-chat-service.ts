// A remote session's chat transcript; read by remote-session-chat-api-service.ts.

import type { RemoteSessionChatMessage } from '../types/remote-session-chat';

export interface RemoteSessionChatHistory {
  /** Oldest first. */
  messages: RemoteSessionChatMessage[];
}

export interface IRemoteSessionChatService {
  /** The people's lines the session dialog holds. */
  history(dialogId: string): Promise<RemoteSessionChatHistory>;
}
