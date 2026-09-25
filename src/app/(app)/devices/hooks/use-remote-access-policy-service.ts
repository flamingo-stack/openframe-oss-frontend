'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { remoteAccessPolicyApiService } from '../services/remote-access-policy-api-service';
import {
  type IRemoteAccessPolicyService,
  mockRemoteAccessPolicyService,
} from '../services/remote-access-policy-service';

export interface RemoteAccessPolicyServiceSelection {
  service: IRemoteAccessPolicyService;
  /** True while the in-memory mock stands in for the backend. */
  isMock: boolean;
  /**
   * False until the flags have answered. A read fired before that would land
   * in the mock's cache and stay there once the flag turns out to be on.
   */
  ready: boolean;
}

/**
 * Which policy backend the settings screens and the connect flow read. The
 * same TEMPORARY `remote-access-approval-api` flag that selects the approval
 * and session clients: the real approval resolves this policy on the server,
 * so the screens must show the same source it decides from.
 */
export function useRemoteAccessPolicyService(): RemoteAccessPolicyServiceSelection {
  const api = useFeatureFlagGate('remote-access-approval-api');
  return api === 'on'
    ? { service: remoteAccessPolicyApiService, isMock: false, ready: true }
    : { service: mockRemoteAccessPolicyService, isMock: true, ready: api === 'off' };
}
