import type { RemoteSessionChatMessage as DesktopChatMessage } from '@flamingo-stack/openframe-frontend-core/components/features';

// Session chat between the technician and the end user during a remote
// screen session. The technician side lives on the remote-desktop page; the
// end user answers in the openframe-chat session block. Both talk to the same
// DIRECT-mode dialog the backend provisions with the session; the mock
// approval backend has no dialog and runs an in-memory stand-in instead.

export type RemoteSessionChatAuthor = 'technician' | 'user';

export interface RemoteSessionChatMessage {
  id: string;
  author: RemoteSessionChatAuthor;
  /** Display name: the technician's name, or "User" for the end user. */
  authorName: string;
  /** ISO timestamp. */
  sentAt: string;
  body: string;
  /** JetStream sequence of the row (live chunks, and history rows the backend stamped); absent on the mock. */
  seq?: number;
}

/** A message as the lib's `RemoteDesktopChatPanel` takes it. */
export function toDesktopChatMessage(message: RemoteSessionChatMessage): DesktopChatMessage {
  return {
    id: message.id,
    author: message.author,
    name: message.authorName,
    text: message.body,
    at: new Date(message.sentAt),
  };
}

/** Who is typing on this side of the chat - shown on the technician's rows. */
export interface RemoteSessionChatTechnician {
  name: string;
  avatarUrl?: string;
}

/** The end user has no profile on the wire - the design shows a plain "User". */
export const REMOTE_SESSION_END_USER_NAME = 'User';
