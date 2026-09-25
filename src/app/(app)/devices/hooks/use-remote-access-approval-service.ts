'use client';

import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { remoteAccessApprovalApiService } from '../services/remote-access-approval-api-service';
import {
  type IRemoteAccessApprovalService,
  mockRemoteAccessApprovalService,
} from '../services/remote-access-approval-service';

export interface RemoteAccessApprovalServiceSelection {
  service: IRemoteAccessApprovalService;
  /**
   * True while the in-memory mock stands in for the backend: the gate then
   * pre-reads the mock policy, shows the simulate-decision strip and skips the
   * NATS decision subscription (the mock pushes through `onDecision`).
   */
  isMock: boolean;
}

/**
 * Which approval backend the connect flow talks to. An environment decision,
 * so a server flag (TEMPORARY `remote-access-approval-api`, on where the
 * approval API is deployed): the real client on, the mock off.
 * Before the flags answer the mock is reported, which is harmless: the gate
 * only fires a request once the `remote-access-approval` gate itself is on,
 * i.e. after the flags have loaded.
 */
export function useRemoteAccessApprovalService(): RemoteAccessApprovalServiceSelection {
  const apiEnabled = useFeatureFlag('remote-access-approval-api');
  return apiEnabled
    ? { service: remoteAccessApprovalApiService, isMock: false }
    : { service: mockRemoteAccessApprovalService, isMock: true };
}
