// Session chat between the technician and the end user during a remote
// screen session. The technician side lives on the remote-desktop page; the
// end user answers in the openframe-chat session block. Both talk to the same
// dialog once the backend provisions it - until then a mock service backs
// this contract.

export type RemoteSessionChatAuthor = 'technician' | 'user';

export interface RemoteSessionChatMessage {
  id: string;
  author: RemoteSessionChatAuthor;
  /** Display name: the technician's name, or "User" for the end user. */
  authorName: string;
  /** ISO timestamp. */
  sentAt: string;
  body: string;
}

/** Who is typing on this side of the chat - shown on the technician's rows. */
export interface RemoteSessionChatTechnician {
  name: string;
  avatarUrl?: string;
}
