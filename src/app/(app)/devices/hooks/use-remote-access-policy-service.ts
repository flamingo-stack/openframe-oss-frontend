'use client';

import { remoteAccessPolicyApiService } from '../services/remote-access-policy-api-service';
import {
  type IRemoteAccessPolicyService,
  mockRemoteAccessPolicyService,
} from '../services/remote-access-policy-service';
import { type RemoteAccessBackendSelection, useRemoteAccessBackend } from './use-remote-access-backend';

export type RemoteAccessPolicyServiceSelection = RemoteAccessBackendSelection<IRemoteAccessPolicyService>;

/**
 * Which policy backend the settings screens and the connect flow read. The
 * same TEMPORARY `remote-access-approval-api` flag that selects the approval
 * and session clients: the real approval resolves this policy on the server,
 * so the screens must show the same source it decides from.
 */
export function useRemoteAccessPolicyService(): RemoteAccessPolicyServiceSelection {
  return useRemoteAccessBackend<IRemoteAccessPolicyService>(
    remoteAccessPolicyApiService,
    mockRemoteAccessPolicyService,
  );
}
