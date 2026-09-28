import type {
  CreateRemoteAccessRequestInput,
  RemoteAccessRequest,
  RemoteAccessRequestStatus,
} from '../types/remote-access';

/**
 * Remote-access approval backend surface, implemented by
 * `RemoteAccessApprovalApiService` (remote-access-approval-api-service.ts).
 *
 * The decision itself is not part of it: it arrives on the technician's NATS
 * notification subject, which `useRemoteAccessApproval` subscribes to, with
 * `get` as the polling fallback for a missed push.
 */
export interface IRemoteAccessApprovalService {
  /**
   * Create an approval request. The server keeps at most one open request per
   * device - a second create while one is open returns the existing request.
   */
  create(input: CreateRemoteAccessRequestInput): Promise<RemoteAccessRequest>;
  get(requestId: string): Promise<RemoteAccessRequest>;
  /** Technician cancels an open request -> REVOKED (client prompt closes). */
  revoke(requestId: string): Promise<void>;
}

const SETTLED: ReadonlySet<RemoteAccessRequestStatus> = new Set([
  'APPROVED',
  'DENIED',
  'TIMED_OUT',
  'REVOKED',
  'CANCELLED',
  'EXPIRED',
]);

export function isSettledRequestStatus(status: RemoteAccessRequestStatus): boolean {
  return SETTLED.has(status);
}
