import type { KeepRecordingSelection } from '@flamingo-stack/openframe-frontend-core/components/features';
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
 * Thrown by `get` when the server has no such recording to show: the id is
 * unknown, its session was deleted, or the file expired or was deleted. The
 * recording page renders its 404 for it, not the "couldn't load" error.
 */
export class RecordingNotFoundError extends Error {
  constructor(message = 'Recording not found') {
    super(message);
    this.name = 'RecordingNotFoundError';
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
  /** Throws {@link RecordingNotFoundError} when the server has no such recording to show. */
  get(recordingId: string): Promise<RecordingDetail>;
  /** Fetch one file's raw `.mcrec` bytes. Throws {@link RecordingUnavailableError}. */
  downloadSegment(segment: RecordingSegment): Promise<ArrayBuffer>;
  /**
   * Delete an ended session: its files, then the session itself, which leaves every list. No restore. Throws the
   * server's refusal (session active, recording still processing, a file kept, storage unavailable).
   */
  delete(sessionId: string): Promise<void>;
  /** Keep every file of an ended session from automatic deletion. Throws the server's refusal (e.g. the kept allowance is full). */
  keep(sessionId: string, selection: KeepRecordingSelection): Promise<void>;
  /** Release the Keep: the files expire again, no earlier than the grace period from now. Throws the server's refusal. */
  release(sessionId: string): Promise<void>;
  /** The tenant's recording storage: what the "Recording storage full" banner reads. */
  storage(): Promise<RecordingStorage>;
}
