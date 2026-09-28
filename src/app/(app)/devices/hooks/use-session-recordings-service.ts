'use client';

import { sessionRecordingsApiService } from '../services/session-recordings-api-service';
import { type ISessionRecordingsService, sessionRecordingsService } from '../services/session-recordings-service';
import { type RemoteAccessBackendSelection, useRemoteAccessBackend } from './use-remote-access-backend';

export type SessionRecordingsServiceSelection = RemoteAccessBackendSelection<ISessionRecordingsService>;

/**
 * Which backend the Remote Sessions tab and the recording page read: the same
 * switch as the approval, session and policy clients, since the sessions
 * listed are the ones that API opened.
 */
export function useSessionRecordingsService(): SessionRecordingsServiceSelection {
  return useRemoteAccessBackend<ISessionRecordingsService>(sessionRecordingsApiService, sessionRecordingsService);
}
