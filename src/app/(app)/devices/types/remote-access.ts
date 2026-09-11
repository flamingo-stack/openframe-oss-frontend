// Remote-access approval read models (CU-86ajx03db).
//
// Shapes mirror the BE contract from the approval-API spec review on
// CU-86ajx02gz: requests move PENDING -> DELIVERED -> APPROVED | DENIED |
// TIMED_OUT | REVOKED, the technician learns the decision via a NATS event
// with a status-GET polling fallback. The backend is still in design, so these
// are the contract the mock service implements and the future client must
// satisfy; field names may still shift with the final API.

/** Which MeshCentral surface the technician is trying to open. */
export type RemoteSessionKind = 'desktop' | 'shell' | 'files';

export type RemoteAccessRequestStatus =
  | 'PENDING'
  /** The client machine acked receipt - someone can actually see the prompt. */
  | 'DELIVERED'
  | 'APPROVED'
  | 'DENIED'
  | 'TIMED_OUT'
  /** The technician cancelled while the request was still open. */
  | 'REVOKED';

export interface RemoteAccessRequest {
  requestId: string;
  deviceId: string;
  sessionKind: RemoteSessionKind;
  status: RemoteAccessRequestStatus;
  /** Why the technician is connecting - shown to the end user in the prompt. */
  reason?: string;
  /** ISO timestamps, server clock (device clocks skew - countdowns use these). */
  createdAt: string;
  expiresAt: string;
}

export interface CreateRemoteAccessRequestInput {
  deviceId: string;
  sessionKind: RemoteSessionKind;
  reason?: string;
}
