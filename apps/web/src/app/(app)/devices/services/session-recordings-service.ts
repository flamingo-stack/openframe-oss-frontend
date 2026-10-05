import type { RecordingDetail, RecordingSegment, RecordingSummary } from '../types/session-recording';

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
  /** Whether a recording can be removed from the tab; the API keeps them until retention does. */
  readonly canDelete: boolean;
  /** The device's remote sessions, newest first. */
  list(deviceId: string): Promise<RecordingSummary[]>;
  get(recordingId: string): Promise<RecordingDetail>;
  /** Fetch one file's raw `.mcrec` bytes. Throws {@link RecordingUnavailableError}. */
  downloadSegment(segment: RecordingSegment): Promise<ArrayBuffer>;
  delete(recordingId: string): Promise<void>;
}
