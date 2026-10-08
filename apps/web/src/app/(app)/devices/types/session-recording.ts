// Remote-session read models for the Remote Sessions tab and the recording
// page. Both the mock service and the openframe-saas-api client produce them.

export interface RecordingEmployee {
  name: string;
  role?: string;
  avatarUrl?: string;
}

/**
 * Where a session's recording stands, from the server's `recordingState`:
 * `none` = recording off, or started without it; `processing` = running, or
 * ended under 30 minutes ago with no file yet; `ready` = something to play;
 * `failed` = no file 30 minutes after the end; `expired` = removed by
 * retention; `deleted` = removed by a technician.
 */
export type RecordingState = 'none' | 'processing' | 'ready' | 'failed' | 'expired' | 'deleted';

/** One row of the Remote Sessions tab: a remote session and the recording it produced, if any. */
export interface RecordingSummary {
  /** The session id. */
  id: string;
  deviceId: string;
  /** ISO timestamp of the session start. */
  startedAt: string;
  /** Null while the session is still running or its recording is processing. */
  durationMs: number | null;
  /** Total size of the session's files; null until one is stored. */
  sizeBytes: number | null;
  /** 1 = terminal, 2 = desktop/KVM. */
  protocol: 1 | 2;
  recordingState: RecordingState;
  /** A file of the session is kept: exempt from retention, and it cannot be deleted. */
  kept: boolean;
  /** ISO timestamp the earliest playable file expires at; null when none is left or none expires. */
  expiresAt: string | null;
  /** The recording page opens on this file (the session's first); null when there is nothing to play. */
  recordingId: string | null;
  /** The technician who ran the session. */
  employee: RecordingEmployee;
}

export interface RecordingChatMessage {
  id: string;
  author: string;
  /** The technician's side of the dialog, as opposed to the end user's. */
  fromTechnician: boolean;
  /** ISO timestamp. */
  sentAt: string;
  body: string;
}

/** One `.mcrec` file of a session; a tunnel that re-pairs produces several, oldest first. */
export interface RecordingSegment {
  id: string;
  /** Where the file's bytes come from; absent while it is still being stored. */
  downloadUrl?: string;
  sizeBytes: number | null;
}

export interface RecordingDetail extends RecordingSummary {
  /** Unknown while the device lookup has not answered or the device is gone. */
  hostname?: string;
  /** `id` is absent for a customer the session could not link to a page. */
  organization: { id?: string; name: string; logoUrl?: string };
  /** e.g. "1280 × 720" - may be unknown until the file is decoded. */
  resolution?: string;
  loggedInUser?: string;
  /** Every file of the session, oldest first; the player joins them into one timeline. */
  segments: RecordingSegment[];
  chat: RecordingChatMessage[];
}

/** The tenant's recording storage. `full` means the pool of recordings that are not kept is used up. */
export interface RecordingStorage {
  usedBytes: number;
  limitBytes: number;
  keptBytes: number;
  keptLimitBytes: number;
  full: boolean;
}
