import {
  type ApprovalToolCallMeta,
  isApprovalNotificationType,
  MINGO_APPROVAL_REQUEST_TYPE,
  TICKET_APPROVAL_REQUEST_TYPE,
} from '@flamingo-stack/openframe-frontend-core';

/**
 * The notification contract as plain data: the flat `type` + `attributes` pair the backend
 * spec catalog emits.
 *
 * Deliberately free of Relay. `notifications-helpers` owns the fragment and evaluates a
 * `graphql` tag at module scope, which anything importing it inherits — including the route
 * mapping, which runs on transports (a cold-start push tap) that have no Relay in play.
 */

/**
 * The approval types and the gate on them live in the core lib, because its approval tile
 * is what reads them; re-exported so the app has one import for the contract.
 */
export { isApprovalNotificationType, MINGO_APPROVAL_REQUEST_TYPE, TICKET_APPROVAL_REQUEST_TYPE };

/**
 * The incident family of backend `TenantNotificationType`s: one emission per detection,
 * then one per status transition, all naming the same incident.
 *
 * INCIDENT_* is the backend's spelling (openframe-saas-tenant PR 3630, which also backfills
 * the stored rows). INSIGHT_* is the spelling before that rename, still recognised for a push
 * or NATS envelope emitted before the release and for a tenant whose backfill has not run
 * yet. The label a card shows is the type as-is - the client never rewrites a backend name.
 */
export const INCIDENT_DETECTED_TYPE = 'INCIDENT_DETECTED';
/** The pre-rename spelling of INCIDENT_DETECTED. */
export const LEGACY_INSIGHT_DETECTED_TYPE = 'INSIGHT_DETECTED';

const INCIDENT_TYPE_PREFIXES = ['INCIDENT_', 'INSIGHT_'] as const;

/**
 * True for any member of the family, including one this release has never heard of: the
 * family shares a prefix by backend convention, and a transition added later should still
 * look and route like its siblings rather than fall back to a generic tile.
 */
export function isIncidentNotificationType(type: unknown): type is string {
  return typeof type === 'string' && INCIDENT_TYPE_PREFIXES.some(prefix => type.startsWith(prefix));
}

/** The detection itself, as opposed to a status transition - the one card drawn by severity. */
export function isIncidentDetectedType(type: unknown): boolean {
  return type === INCIDENT_DETECTED_TYPE || type === LEGACY_INSIGHT_DETECTED_TYPE;
}

/**
 * Attribute keys this app reads out of the flat `attributes` map. Every other key the
 * backend sends rides along into `meta` untouched — the catalog adds facts (ticketNumber,
 * actorName, machineId, …) without a client release, and dropping them here would be the
 * one thing that makes that not true.
 */
export const NOTIFICATION_ATTR = {
  ticketId: 'ticketId',
  dialogId: 'dialogId',
  insightId: 'insightId',
  /** The incident's own `InsightSeverity` (CRITICAL … INFO), on every insight type. */
  insightSeverity: 'insightSeverity',
  approvalRequestId: 'approvalRequestId',
  approvalType: 'approvalType',
  resolution: 'resolution',
  resolvedByName: 'resolvedByName',
  toolCalls: 'toolCalls',
} as const;

/**
 * Narrow the `attributes` JSON scalar (typed `any` by relay-compiler) to the flat
 * string map the contract promises. Non-string values and empty strings are dropped:
 * the contract says an absent fact is a MISSING KEY, so an empty string would otherwise
 * read as a present-but-blank id and route somewhere that doesn't exist.
 */
export function readNotificationAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const attributes: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw !== '') attributes[key] = raw;
  }
  return attributes;
}

/**
 * Backend `ApprovalResolution` values that mean the request is settled. PENDING is
 * deliberately NOT one of them: the attribute map carries the key from the start
 * (`PENDING` on a freshly emitted request), so a truthiness check would retire every
 * approval to the read list the moment any UPDATED push touched it — the card would
 * vanish from the drawer still awaiting a decision.
 */
const TERMINAL_APPROVAL_RESOLUTIONS: ReadonlySet<string> = new Set(['APPROVED', 'REJECTED', 'CANCELLED']);

export function isApprovalResolved(resolution: unknown): boolean {
  return typeof resolution === 'string' && TERMINAL_APPROVAL_RESOLUTIONS.has(resolution.toUpperCase());
}

function normalizeToolCall(raw: unknown): ApprovalToolCallMeta {
  const call = (raw ?? {}) as Record<string, unknown>;
  return {
    toolExecutionRequestId: typeof call.toolExecutionRequestId === 'string' ? call.toolExecutionRequestId : null,
    toolName: typeof call.toolName === 'string' ? call.toolName : '',
    toolTitle: typeof call.toolTitle === 'string' ? call.toolTitle : null,
    toolExplanation: typeof call.toolExplanation === 'string' ? call.toolExplanation : null,
    toolType: typeof call.toolType === 'string' ? call.toolType : null,
    requiresApproval: Boolean(call.requiresApproval),
    approvalType: typeof call.approvalType === 'string' ? call.approvalType : null,
    toolCallArguments:
      call.toolCallArguments && typeof call.toolCallArguments === 'object'
        ? (call.toolCallArguments as Record<string, unknown>)
        : null,
  };
}

/**
 * `attributes.toolCalls` is a JSON-encoded array inside a string (every attribute value is
 * a string). Malformed input yields an empty list rather than throwing: a broken tool list
 * must not take the whole notification down with it.
 */
export function parseAttributeToolCalls(raw: string | undefined): ApprovalToolCallMeta[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeToolCall) : [];
  } catch {
    return [];
  }
}
