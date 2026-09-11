// Session-recording read models (CU-86akc3ce5).
//
// Shapes mirror the Figma mockups (devices 744-40363 list, 758-46350 detail);
// the storage backend (CU-86akc3c5q) is still in flight, so these are the
// contract the mock service implements and the future BE client must satisfy.

export interface RecordingEmployee {
  name: string;
  role?: string;
  avatarUrl?: string;
}

export interface RecordingSummary {
  id: string;
  deviceId: string;
  /** ISO timestamp of the session start. */
  startedAt: string;
  /** Null while the recording is still processing. */
  durationMs: number | null;
  /** Null while the recording is still processing. */
  sizeBytes: number | null;
  /** 1 = terminal, 2 = desktop/KVM. */
  protocol: 1 | 2;
  processing: boolean;
  /** The technician who ran the session. */
  employee: RecordingEmployee;
}

export interface RecordingChatMessage {
  id: string;
  author: string;
  /** ISO timestamp. */
  sentAt: string;
  body: string;
}

export interface RecordingDetail extends RecordingSummary {
  hostname: string;
  organization: { id: string; name: string; logoUrl?: string };
  /** e.g. "1280 × 720" - may be unknown until the file is decoded. */
  resolution?: string;
  loggedInUser?: string;
  /** Signed GET for the .mcrec bytes; absent while processing. */
  downloadUrl?: string;
  chat: RecordingChatMessage[];
}
