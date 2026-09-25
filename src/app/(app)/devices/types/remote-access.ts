// Remote-access approval read models.
//
// Shapes follow the BE approval contract (OpenAPI 1.0.0-draft): requests move
// PENDING -> DELIVERED -> APPROVED | DENIED | TIMED_OUT | REVOKED; the
// technician learns the decision from the REMOTE_ACCESS_DECISION event on
// `user.<technicianUserId>.notification` with a status-GET poll every 2 s as
// the fallback. The real client
// (remote-access-approval-api-service.ts) and the in-memory mock both produce
// these shapes.

/** Which MeshCentral surface the technician is trying to open. */
// The approval flow covers remote screen (MeshCentral desktop) sessions only:
// remote shell and file manager are out of the epic's scope and keep their
// legacy auto-start. The wire value is always 'desktop'.
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
  sessionKind: RemoteSessionKind;
  status: RemoteAccessRequestStatus;
  /** Why the technician is connecting - shown to the end user in the prompt. */
  reason?: string;
  ticketId?: string;
  ticketNumber?: string;
  /**
   * The policy mode the server resolved at creation (recorded for audit per
   * the approval contract). DENY_ACCESS arrives already DENIED; NOTIFY_ONLY
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
 * Why a create was refused: `DEVICE_HAS_LIVE_REQUEST` and
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
 * `<requestId>.<p>.<nonce>` - the gateway gate matches the first token
 * against the approval grant. `p` is the Mesh protocol number (2 = desktop);
 * the nonce keeps every tunnel of the session (multi-monitor "Show All")
 * unique.
 */
export function buildRemoteAccessRelayIdPrefix(requestId: string, protocol: number): string {
  return `${requestId}.${protocol}`;
}

// --------------------------------------------------------------------------
// Remote access policy
// --------------------------------------------------------------------------

/**
 * How a remote connection to a device is admitted. One mode per scope
 * (tenant default -> per-organization -> per-device override), no split by
 * session kind - a product decision.
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
    description: 'No approval prompt. The user sees the session block, can chat and can end the session.',
  },
  SILENT_ACCESS: {
    label: 'Silent Access',
    description: 'No prompt, no indicator, no chat. The user cannot end the session.',
  },
  DENY_ACCESS: {
    label: 'Deny Access',
    description: 'Remote Control is blocked. Remote shell and file manager are not affected.',
  },
};

/**
 * Tenant-wide remote access policy: the default mode only. The approval
 * timeout (30 s), the delivery timeout and the no-client / no-answer fallbacks
 * are fixed backend constants - not a tenant setting and not surfaced in the UI.
 */
export interface TenantRemoteAccessPolicy {
  mode: RemoteAccessMode;
}

export const REMOTE_ACCESS_POLICY_SCOPES = ['DEVICE', 'ORGANIZATION', 'TENANT', 'DEFAULTS'] as const;
/** Where a device's effective mode came from; DEFAULTS = nothing saved at any scope. */
export type RemoteAccessPolicyScope = (typeof REMOTE_ACCESS_POLICY_SCOPES)[number];

/** Per-organization policy: the override (`null` = inherits the tenant default) and what applies. */
export interface OrganizationRemoteAccessPolicy {
  mode: RemoteAccessMode | null;
  effectiveMode: RemoteAccessMode;
}

/** Per-device policy: the override (`null` = inherits), what applies, and the scope it came from. */
export interface DeviceRemoteAccessPolicy {
  mode: RemoteAccessMode | null;
  effectiveMode: RemoteAccessMode;
  effectiveScope: RemoteAccessPolicyScope;
}

// --------------------------------------------------------------------------
// Remote session lifecycle
// --------------------------------------------------------------------------

export type RemoteSessionStatus = 'ACTIVE' | 'ENDED';

/**
 * Why a session is over: `client` - the end user pressed End Session, `admin`
 * - the technician left, `timeout` - the session cap passed, `connection_lost`
 * - the tunnel dropped (there is no rejoin: the technician opens a new
 * session), `policy` - reserved, nothing produces it yet. Lower-case as on the
 * NATS wire; the GraphQL enum arrives upper-case and is folded.
 */
export type RemoteSessionEndReason = 'admin' | 'client' | 'timeout' | 'connection_lost' | 'policy';

/**
 * The session record the backend creates when a request reaches APPROVED:
 * the technician's handle for ending the session, and the source of the chat
 * dialog id. Every lifecycle event carries the same payload.
 */
export interface RemoteSession {
  /** A plain 26-char ULID. */
  sessionId: string;
  requestId: string;
  deviceId?: string;
  technicianId?: string;
  sessionKind: RemoteSessionKind;
  mode?: RemoteAccessMode;
  status: RemoteSessionStatus;
  startedAt: string;
  endedAt?: string | null;
  endReason?: RemoteSessionEndReason | null;
  reason?: string;
  ticketId?: string;
  ticketNumber?: string;
  recordingEnabled?: boolean;
  /** The session chat dialog; null until the backend provisions it. */
  dialogId: string | null;
}

/** How a session ended, as far as the page knows. */
export interface RemoteSessionEnd {
  endReason: RemoteSessionEndReason | null;
  endedAt: string | null;
}

/**
 * The transient technician-side lifecycle event on
 * `user.<technicianUserId>.notification` (flat JSON, no notification id, so
 * the notifications drawer ignores it): the session payload, plus `endReason`
 * and `endedAt` on ENDED.
 */
export interface RemoteSessionEvent {
  type: 'REMOTE_SESSION_STARTED' | 'REMOTE_SESSION_ENDED';
  sessionId: string;
  requestId?: string;
  startedAt?: string;
  dialogId: string | null;
  recordingEnabled?: boolean;
  endReason: RemoteSessionEndReason | null;
  endedAt?: string | null;
}
