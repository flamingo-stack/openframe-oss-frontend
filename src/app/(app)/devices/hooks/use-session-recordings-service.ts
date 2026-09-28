'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { sessionRecordingsApiService } from '../services/session-recordings-api-service';
import { type ISessionRecordingsService, sessionRecordingsService } from '../services/session-recordings-service';

export interface SessionRecordingsServiceSelection {
  service: ISessionRecordingsService;
  /** True while the in-memory mock stands in for the backend. */
  isMock: boolean;
  /** False until the flags have answered; a read fired earlier would land in the mock's cache. */
  ready: boolean;
}

/**
 * Which backend the Remote Sessions tab and the recording page read: the same
 * TEMPORARY `remote-access-approval-api` flag as the approval, session and
 * policy clients, since the sessions listed are the ones that API opened.
 */
export function useSessionRecordingsService(): SessionRecordingsServiceSelection {
  const api = useFeatureFlagGate('remote-access-approval-api');
  return api === 'on'
    ? { service: sessionRecordingsApiService, isMock: false, ready: true }
    : { service: sessionRecordingsService, isMock: true, ready: api === 'off' };
}
