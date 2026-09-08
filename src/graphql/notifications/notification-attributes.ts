import {
  ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
  type ApprovalToolCallMeta,
} from '@flamingo-stack/openframe-frontend-core';

/**
 * The notification contract as plain data: the flat `type` + `attributes` pair the backend
 * spec catalog emits, and the legacy discriminators it replaces.
 *
 * Deliberately free of Relay. `notifications-helpers` owns the fragment and evaluates a
 * `graphql` tag at module scope, which anything importing it inherits — including the route
 * mapping, which runs on transports (a cold-start push tap) that have no Relay in play.
 */
/**
 * Spec-catalog approval types. The backend splits the single legacy approval by ticket
 * linkage, but keeps `context.type` at `ADMIN_APPROVAL_REQUEST` on both — so only the
 * top-level `type` tells them apart.
 */
export const TICKET_APPROVAL_REQUEST_TYPE = 'TICKET_APPROVAL_REQUEST';
export const MINGO_APPROVAL_REQUEST_TYPE = 'MINGO_APPROVAL_REQUEST';

const APPROVAL_TYPES: ReadonlySet<string> = new Set([
  ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
  TICKET_APPROVAL_REQUEST_TYPE,
  MINGO_APPROVAL_REQUEST_TYPE,
]);

/**
 * Attribute keys this app reads out of the flat `attributes` map. Every other key the
 * backend sends rides along into `meta` untouched — the catalog adds facts (ticketNumber,
 * actorName, machineId, …) without a client release, and dropping them here would be the
 * one thing that makes that not true.
 */
export const NOTIFICATION_ATTR = {
  ticketId: 'ticketId',
  dialogId: 'dialogId',
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

/** True for either spec approval type and for the legacy context discriminator. */
export function isApprovalNotificationType(type: string | null | undefined): boolean {
  return !!type && APPROVAL_TYPES.has(type);
}

/**
 * Fold the approval split back onto the legacy discriminator for `meta.contextType`.
 * The core lib gates its approval tile on that exact string and is shared across six
 * projects, so the normalization happens here rather than there. The precise type stays
 * available on `meta.notificationType`.
 */
export function toLegacyContextType(type: string | null | undefined): string | undefined {
  if (!type) return undefined;
  return isApprovalNotificationType(type) ? ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE : type;
}

/**
 * Backend `ApprovalResolution` values that mean the request is settled. PENDING is
 * deliberately NOT one of them.
 *
 * This matters because the two contracts disagree about what an unresolved approval looks
 * like: the legacy context left `resolution` null until the request was settled, while the
 * attribute map carries the key from the start (`PENDING` on a freshly emitted request). A
 * truthiness check was correct for the first and would, on the second, retire every approval
 * to the read list the moment any UPDATED push touched it — the card would vanish from the
 * drawer still awaiting a decision.
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

/** Normalize tool calls arriving as objects — the legacy typed context and the legacy NATS payload. */
export function normalizeToolCalls(raw: unknown): ApprovalToolCallMeta[] {
  return Array.isArray(raw) ? raw.map(normalizeToolCall) : [];
}

/**
 * `attributes.toolCalls` is a JSON-encoded array inside a string (every attribute value is
 * a string). Malformed input yields an empty list rather than throwing: a broken tool list
 * must not take the whole notification down with it.
 */
export function parseAttributeToolCalls(raw: string | undefined): ApprovalToolCallMeta[] {
  if (!raw) return [];
  try {
    return normalizeToolCalls(JSON.parse(raw));
  } catch {
    return [];
  }
}
