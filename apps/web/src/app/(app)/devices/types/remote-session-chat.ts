// Session chat between the technician and the end user during a remote
// screen session. The technician side lives on the remote-desktop page; the
// end user answers in the openframe-chat session block. Both talk to the same
// DIRECT-mode dialog the backend provisions with the session; the mock
// approval backend has no dialog and runs an in-memory stand-in instead.

import type { RemoteSessionChatMessage } from '@flamingo-stack/openframe-frontend-core/components/features';

export type RemoteSessionChatRowAuthor = 'technician' | 'user';

/** One chat line as the dialog delivers it; the panel renders it as the shared `RemoteSessionChatMessage`. */
export interface RemoteSessionChatRow {
  id: string;
  author: RemoteSessionChatRowAuthor;
  /** Display name: the technician's name, or "User" for the end user. */
  authorName: string;
  /** ISO timestamp. */
  sentAt: string;
  body: string;
  /** JetStream sequence of the row (live chunks, and history rows the backend stamped); absent on the mock. */
  seq?: number;
}

/** The end user has no profile on the wire - the design shows a plain "User". */
export const REMOTE_SESSION_END_USER_NAME = 'User';

/** A dialog row as the chat panel takes it. */
export function toRemoteSessionChatMessage(row: RemoteSessionChatRow): RemoteSessionChatMessage {
  return { id: row.id, author: row.author, name: row.authorName, text: row.body, at: new Date(row.sentAt) };
}
