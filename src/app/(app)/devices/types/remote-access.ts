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
  /**
   * The policy mode the server resolved at creation (recorded for audit per
   * the CU-86ajx02gz contract). DENY_ACCESS arrives already DENIED; NOTIFY_ONLY
   * and SILENT_ACCESS arrive already APPROVED.
   */
  resolvedMode?: RemoteAccessMode;
  /** ISO timestamps, server clock (device clocks skew - countdowns use these). */
  createdAt: string;
  expiresAt: string;
}

export interface CreateRemoteAccessRequestInput {
  deviceId: string;
  sessionKind: RemoteSessionKind;
  reason?: string;
  /**
   * Mock-only resolution hint: the real API derives the device's organization
   * server-side; the in-memory mock has no device registry, so callers that
   * know the organization pass it for the org-level override to apply.
   */
  organizationId?: string;
}

// --------------------------------------------------------------------------
// Remote access policy (CU-86akeqw8b / CU-86akeqw6h)
// --------------------------------------------------------------------------

/**
 * How a remote connection to a device is admitted. One mode per scope
 * (tenant default -> per-organization -> per-device override), no split by
 * session kind - per the product decision on CU-86akeqw6h.
 */
export const REMOTE_ACCESS_MODES = ['APPROVAL_REQUIRED', 'NOTIFY_ONLY', 'SILENT_ACCESS', 'DENY_ACCESS'] as const;
export type RemoteAccessMode = (typeof REMOTE_ACCESS_MODES)[number];

/** Display copy per mode - labels and descriptions from the access-level designs. */
export const REMOTE_ACCESS_MODE_META: Record<RemoteAccessMode, { label: string; description: string }> = {
  APPROVAL_REQUIRED: {
    label: 'Approval Required',
    description: 'User approves each session before it starts.',
  },
  NOTIFY_ONLY: {
    label: 'Notify Only',
    description: 'No approval needed, user sees a notification.',
  },
  SILENT_ACCESS: {
    label: 'Silent Access',
    description: 'No approval, no notification.',
  },
  DENY_ACCESS: {
    label: 'Deny Access',
    description: 'Remote connect is disabled for this device.',
  },
};

/**
 * What happens when an approval request cannot be answered - either no client
 * is connected to ack delivery (`noClientFallback`) or the user never answered
 * before the approval timeout (`noAnswerFallback`).
 */
export const REMOTE_ACCESS_FALLBACKS = ['DENY', 'ALLOW_WITH_NOTIFICATION', 'ALLOW_SILENTLY'] as const;
export type RemoteAccessFallback = (typeof REMOTE_ACCESS_FALLBACKS)[number];

export const REMOTE_ACCESS_FALLBACK_META: Record<RemoteAccessFallback, { label: string }> = {
  DENY: { label: 'Deny' },
  ALLOW_WITH_NOTIFICATION: { label: 'Allow with Notification' },
  ALLOW_SILENTLY: { label: 'Allow Silently' },
};

/** Tenant-wide remote access policy: the default mode plus approval tuning. */
export interface TenantRemoteAccessPolicy {
  mode: RemoteAccessMode;
  /** How long the end user has to answer an approval prompt. */
  approvalTimeoutSeconds: number;
  /** How long to wait for a client to ack delivery before `noClientFallback`. */
  deliveryTimeoutSeconds: number;
  noClientFallback: RemoteAccessFallback;
  noAnswerFallback: RemoteAccessFallback;
  /** Whether the technician must give a reason on connect. */
  reasonRequired: boolean;
}
