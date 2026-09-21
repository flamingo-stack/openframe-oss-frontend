import { apiClient } from '@/lib/api-client';
import {
  type CreateRemoteAccessRequestInput,
  type RemoteAccessCreateErrorCode,
  RemoteAccessCreateError,
  type RemoteAccessDecisionEvent,
  type RemoteAccessDecisionSource,
  type RemoteAccessMode,
  type RemoteAccessRequest,
  type RemoteAccessRequestStatus,
} from '../types/remote-access';
import type { IRemoteAccessApprovalService } from './remote-access-approval-service';

/**
 * The real approval API (CU-86ajx02gz, saas-tenant PR #3241 + saas-lib PR
 * #885): technician endpoints on openframe-saas-api under
 * `/api/v1/remote-access/requests` with the admin session, through
 * `apiClient` like the rest of the REST surface. `deviceId` is the OpenFrame
 * machine id (the backend resolves the machine, its mesh node and organization
 * from it), which is what the device pages carry as `?id=`.
 *
 * Create answers 201 for a new request, 200 with the technician's own live
 * request (a page reload re-attaches without a second end-user prompt), 409
 * with an error code for another technician's request or session, 503 when the
 * request could not be published. The decision push is not part of this
 * service: it arrives as a flat REMOTE_ACCESS_DECISION event on the technician's
 * notification subject, which `useRemoteAccessApproval` subscribes to
 * (see `parseRemoteAccessDecisionEvent`); `onDecision` is therefore a no-op here.
 */
const REQUESTS_PATH = '/api/v1/remote-access/requests';

const STATUSES: ReadonlySet<string> = new Set([
  'PENDING',
  'DELIVERED',
  'APPROVED',
  'DENIED',
  'TIMED_OUT',
  'REVOKED',
  'CANCELLED',
  'EXPIRED',
]);
const MODES: ReadonlySet<string> = new Set(['APPROVAL_REQUIRED', 'NOTIFY_ONLY', 'SILENT_ACCESS', 'DENY_ACCESS']);
const DECISION_SOURCES: ReadonlySet<string> = new Set(['USER', 'POLICY', 'FALLBACK', 'TECHNICIAN', 'TIMEOUT']);
const CREATE_ERROR_CODES: ReadonlySet<string> = new Set([
  'DEVICE_HAS_LIVE_REQUEST',
  'DEVICE_HAS_ACTIVE_SESSION',
  'DEVICE_UNREACHABLE',
  'REMOTE_ACCESS_DISABLED',
]);

// Terminal statuses for which a 409 on revoke means "already settled, nothing to cancel".
const SETTLED_STATUSES: ReadonlySet<string> = new Set(['APPROVED', 'DENIED', 'TIMED_OUT', 'REVOKED', 'CANCELLED', 'EXPIRED']);

type Raw = Record<string, unknown>;

function text(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Timestamps come as ISO-8601 strings (Spring's default Instant serialization);
 * a numeric epoch (seconds, possibly fractional, or milliseconds) is accepted
 * too, so a Jackson setting on one host cannot silently break the countdown.
 */
function timestamp(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1e12 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  return undefined;
}

function nullableTimestamp(raw: Raw, key: string): string | null | undefined {
  return raw[key] === null ? null : timestamp(raw, key);
}

function oneOf<T extends string>(value: unknown, allowed: ReadonlySet<string>): T | undefined {
  return typeof value === 'string' && allowed.has(value) ? (value as T) : undefined;
}

/** The wire request object -> the app's read model. Throws on a body without the required fields. */
export function normalizeRemoteAccessRequest(data: unknown): RemoteAccessRequest {
  const raw = (data ?? {}) as Raw;
  const requestId = text(raw, 'requestId');
  const status = oneOf<RemoteAccessRequestStatus>(raw.status, STATUSES);
  if (!requestId || !status) {
    throw new Error('Malformed remote access request from the server');
  }
  const decisionSource =
    raw.decisionSource === null ? null : oneOf<RemoteAccessDecisionSource>(raw.decisionSource, DECISION_SOURCES);
  return {
    requestId,
    deviceId: text(raw, 'deviceId') ?? '',
    machineId: text(raw, 'machineId'),
    sessionKind: 'desktop',
    status,
    reason: text(raw, 'reason'),
    ticketId: text(raw, 'ticketId'),
    ticketNumber: text(raw, 'ticketNumber'),
    // `mode` on the wire; `resolvedMode` was the mock's name before the contract settled.
    mode: oneOf<RemoteAccessMode>(raw.mode ?? raw.resolvedMode, MODES),
    decisionSource,
    technicianId: text(raw, 'technicianId'),
    recordingEnabled: raw.recordingEnabled === true,
    createdAt: timestamp(raw, 'createdAt') ?? new Date().toISOString(),
    expiresAt: timestamp(raw, 'expiresAt') ?? new Date().toISOString(),
    deliveredAt: nullableTimestamp(raw, 'deliveredAt'),
    resolvedAt: nullableTimestamp(raw, 'resolvedAt'),
  };
}

/** A notification-subject payload -> the decision event, or `null` for anything else. */
export function parseRemoteAccessDecisionEvent(payload: unknown): RemoteAccessDecisionEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Raw;
  if (raw.type !== 'REMOTE_ACCESS_DECISION') return null;
  const requestId = text(raw, 'requestId');
  const status = oneOf<RemoteAccessDecisionEvent['status']>(
    raw.status,
    new Set(['DELIVERED', 'APPROVED', 'DENIED', 'TIMED_OUT', 'REVOKED']),
  );
  if (!requestId || !status) return null;
  return {
    type: 'REMOTE_ACCESS_DECISION',
    requestId,
    status,
    decisionSource: oneOf<RemoteAccessDecisionSource>(raw.decisionSource, DECISION_SOURCES) ?? null,
    mode: oneOf<RemoteAccessMode>(raw.mode, MODES) ?? null,
    deliveredAt: nullableTimestamp(raw, 'deliveredAt'),
    resolvedAt: nullableTimestamp(raw, 'resolvedAt'),
  };
}

/** Merge a decision event into the request it belongs to (same field names on both). */
export function applyRemoteAccessDecisionEvent(
  request: RemoteAccessRequest,
  event: RemoteAccessDecisionEvent,
): RemoteAccessRequest {
  return {
    ...request,
    status: event.status,
    decisionSource: event.decisionSource,
    mode: event.mode ?? request.mode,
    deliveredAt: event.deliveredAt ?? request.deliveredAt,
    resolvedAt: event.resolvedAt ?? request.resolvedAt,
  };
}

function createErrorFrom(status: number, data: unknown, fallback: string | undefined): RemoteAccessCreateError {
  const raw = (data ?? {}) as Raw;
  const code = oneOf<RemoteAccessCreateErrorCode>(raw.code, CREATE_ERROR_CODES);
  const message = text(raw, 'message') ?? fallback ?? `Request failed with status ${status}`;
  if (code) return new RemoteAccessCreateError(code, message, status);
  if (status === 503) return new RemoteAccessCreateError('DEVICE_UNREACHABLE', message, status);
  return new RemoteAccessCreateError('UNKNOWN', message, status);
}

export class RemoteAccessApprovalApiService implements IRemoteAccessApprovalService {
  async create(input: CreateRemoteAccessRequestInput): Promise<RemoteAccessRequest> {
    const body: Record<string, unknown> = { deviceId: input.deviceId, sessionKind: input.sessionKind };
    if (input.reason) body.reason = input.reason;
    if (input.ticketId) body.ticketId = input.ticketId;
    const response = await apiClient.post<unknown>(REQUESTS_PATH, body);
    if (!response.ok) throw createErrorFrom(response.status, response.data, response.error);
    return normalizeRemoteAccessRequest(response.data);
  }

  async get(requestId: string): Promise<RemoteAccessRequest> {
    const response = await apiClient.get<unknown>(`${REQUESTS_PATH}/${encodeURIComponent(requestId)}`);
    if (!response.ok) throw new Error(response.error ?? `Request failed with status ${response.status}`);
    return normalizeRemoteAccessRequest(response.data);
  }

  async revoke(requestId: string): Promise<void> {
    const response = await apiClient.post<unknown>(`${REQUESTS_PATH}/${encodeURIComponent(requestId)}/revoke`);
    if (!response.ok) {
      // 409 = already settled; there is nothing left to cancel, the outcome is the same.
      // But only when the body confirms a terminal status - a 409 for any other reason
      // (e.g. an unrelated concurrent modification) must still surface as a failure.
      if (response.status === 409) {
        const raw = (response.data ?? {}) as Raw;
        const status = oneOf<RemoteAccessRequestStatus>(raw.status, STATUSES);
        if (status && SETTLED_STATUSES.has(status)) return;
      }
      throw new Error(response.error ?? `Request failed with status ${response.status}`);
    }
  }

  onDecision(): () => void {
    // The push channel is the NATS notification subject, subscribed in the hook.
    return () => {};
  }
}

export const remoteAccessApprovalApiService = new RemoteAccessApprovalApiService();
