// Remote-access approval read models (CU-86ajx03db).
//
// Shapes follow the BE contract on CU-86ajx02gz (OpenAPI 1.0.0-draft, decisions
// of 2026-09-16/17): requests move PENDING -> DELIVERED -> APPROVED | DENIED |
// TIMED_OUT | REVOKED; the technician learns the decision from the
// REMOTE_ACCESS_DECISION event on `user.<technicianUserId>.notification` with a
// status-GET poll every 2 s as the fallback. The real client
// (remote-access-approval-api-service.ts) and the in-memory mock both produce
// these shapes.

/** Which MeshCentral surface the technician is trying to open. */
// The approval flow covers remote screen (MeshCentral desktop) sessions only
// (decision 2026-09-16): remote shell and file manager are out of the epic's
// scope and keep their legacy auto-start. The wire value is always 'desktop'.
export type RemoteSessionKind = 'desktop';

export type RemoteAccessRequestStatus =
  | 'PENDING'
  /** The client machine acked receipt - someone can actually see the prompt. */
  | 'DELIVERED'
  | 'APPROVED'
  | 'DENIED'
  | 'TIMED_OUT'
  /** The technician cancelled while the request was still open. */
  | 'REVOKED'
  /**
   * Never emitted by the technician API (JetStream-era aliases the chat still
   * tolerates); accepted as terminal in case they ever show up on the wire.
   */
  | 'CANCELLED'
  | 'EXPIRED';

/** Who settled the request. `null` while it is open. */
export type RemoteAccessDecisionSource = 'USER' | 'POLICY' | 'FALLBACK' | 'TECHNICIAN' | 'TIMEOUT';

export interface RemoteAccessRequest {
  /** A plain 26-char ULID; the first token of the MeshCentral relay id (see buildRemoteAccessRelayIdPrefix). */
  requestId: string;
  /** The OpenFrame machine id - what the device pages carry as `?id=` and what the backend resolves. */
  deviceId: string;
  machineId?: string;
  sessionKind: RemoteSessionKind;
  status: RemoteAccessRequestStatus;
  /** Why the technician is connecting - shown to the end user in the prompt. */
  reason?: string;
  ticketId?: string;
  ticketNumber?: string;
  /**
   * The policy mode the server resolved at creation (recorded for audit per
   * the CU-86ajx02gz contract). DENY_ACCESS arrives already DENIED; NOTIFY_ONLY
   * and SILENT_ACCESS arrive already APPROVED.
   */
  mode?: RemoteAccessMode;
  decisionSource?: RemoteAccessDecisionSource | null;
  technicianId?: string;
  /** Whether the session will be recorded (tenant mesh recording config); informational. */
  recordingEnabled?: boolean;
  /** ISO timestamps, server clock (device clocks skew - countdowns use these). */
  createdAt: string;
  expiresAt: string;
  deliveredAt?: string | null;
  resolvedAt?: string | null;
}

export interface CreateRemoteAccessRequestInput {
  deviceId: string;
  sessionKind: RemoteSessionKind;
  reason?: string;
  /** When the technician connects from a ticket; the backend resolves the number. */
  ticketId?: string;
  /**
   * Mock-only resolution hint: the real API derives the device's organization
   * server-side; the in-memory mock has no device registry, so callers that
   * know the organization pass it for the org-level override to apply.
   */
  organizationId?: string;
}

/**
 * Why a create was refused (CU-86ajx02gz): `DEVICE_HAS_LIVE_REQUEST` and
 * `DEVICE_HAS_ACTIVE_SESSION` are the 409s for another technician's request or
 * session (one technician per device at a time; the body carries no
 * identifiers), `DEVICE_UNREACHABLE` is the 503 when the request could not be
 * published (the request is deleted, a retry is safe), `UNKNOWN` is anything else.
 */
export type RemoteAccessCreateErrorCode =
  | 'DEVICE_HAS_LIVE_REQUEST'
  | 'DEVICE_HAS_ACTIVE_SESSION'
  | 'DEVICE_UNREACHABLE'
  /** 404: the backend switch `openframe.remote-access-approval.enabled` is off on this environment. */
  | 'REMOTE_ACCESS_DISABLED'
  | 'UNKNOWN';

export class RemoteAccessCreateError extends Error {
  constructor(
    readonly code: RemoteAccessCreateErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RemoteAccessCreateError';
  }
}

/**
 * The transient technician-side event on `user.<technicianUserId>.notification`
 * (flat JSON, no notification id, so the notifications drawer ignores it).
 * Sent for attended requests only: once on the device's ack (DELIVERED) and
 * once on settlement; instant modes settle inside the create response.
 */
export interface RemoteAccessDecisionEvent {
  type: 'REMOTE_ACCESS_DECISION';
  requestId: string;
  status: Extract<RemoteAccessRequestStatus, 'DELIVERED' | 'APPROVED' | 'DENIED' | 'TIMED_OUT' | 'REVOKED'>;
  decisionSource: RemoteAccessDecisionSource | null;
  mode?: RemoteAccessMode | null;
  deliveredAt?: string | null;
  resolvedAt?: string | null;
}

/**
 * The MeshCentral relay id of a session opened under an approval:
 * `<requestId>.<p>.<nonce>` (CU-86ajx02gz) - the gateway gate (CU-86ajx02x3)
 * matches the first token against the approval grant. `p` is the Mesh
 * protocol number (2 = desktop); the nonce keeps every tunnel of the session
 * (multi-monitor "Show All") unique.
 */
export function buildRemoteAccessRelayIdPrefix(requestId: string, protocol: number): string {
  return `${requestId}.${protocol}`;
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
 * Tenant-wide remote access policy: the default mode only. The approval
 * timeout (30 s), the delivery timeout and the no-client / no-answer fallbacks
 * are fixed backend constants (decision 2026-09-18, CU-86akeqw6h) - not a
 * tenant setting and not surfaced in the UI.
 */
export interface TenantRemoteAccessPolicy {
  mode: RemoteAccessMode;
}
