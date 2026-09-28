'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';

export interface RemoteAccessBackendSelection<S> {
  service: S;
  /** True while the in-memory mock stands in for the backend. */
  isMock: boolean;
  /**
   * False until the flags have answered. A read fired before that would land
   * in the mock's cache and stay there once the flag turns out to be on.
   */
  ready: boolean;
}

/**
 * Picks the openframe-saas-api client or its in-memory mock by the TEMPORARY
 * `remote-access-approval-api` flag, for the remote access surfaces that read
 * through react-query. Tri-state on purpose: the mock is only a fallback once
 * the flag has said off.
 */
export function useRemoteAccessBackend<S>(api: S, mock: S): RemoteAccessBackendSelection<S> {
  const gate = useFeatureFlagGate('remote-access-approval-api');
  return gate === 'on'
    ? { service: api, isMock: false, ready: true }
    : { service: mock, isMock: true, ready: gate === 'off' };
}
