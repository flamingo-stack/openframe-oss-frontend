import type { RecordingDetail, RecordingSegment, RecordingStorage, RecordingSummary } from '../types/session-recording';

/**
 * Thrown by `downloadSegment` when a file's bytes cannot be fetched - it has
 * no download URL yet, or the storage request failed. The player page renders
 * its "Session recording unavailable" state when no file of the session loads.
 */
export class RecordingUnavailableError extends Error {
  constructor(message = 'Session recording unavailable') {
    super(message);
    this.name = 'RecordingUnavailableError';
  }
}

/**
 * Session-recordings backend surface, implemented by the openframe-saas-api
 * client (session-recordings-api-service.ts).
 */
export interface ISessionRecordingsService {
  /** Whether recordings can be deleted at all; which ones, the row's own state says. */
  readonly canDelete: boolean;
  /** The device's remote sessions, newest first. */
  list(deviceId: string): Promise<RecordingSummary[]>;
  get(recordingId: string): Promise<RecordingDetail>;
  /** Fetch one file's raw `.mcrec` bytes. Throws {@link RecordingUnavailableError}. */
  downloadSegment(segment: RecordingSegment): Promise<ArrayBuffer>;
  /** Delete every file of an ended session. Throws the server's refusal (session active, a file kept). */
  delete(sessionId: string): Promise<void>;
  /** The tenant's recording storage: what the "Recording storage full" banner reads. */
  storage(): Promise<RecordingStorage>;
}
