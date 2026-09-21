import { commitMutation, fetchQuery, graphql } from 'react-relay';
import { type GraphQLTaggedNode, type MutationParameters, readInlineData } from 'relay-runtime';
import type {
  remoteAccessApprovalApiService_request$data as WireRequest,
  remoteAccessApprovalApiService_request$key as WireRequestKey,
} from '@/__generated__/remoteAccessApprovalApiService_request.graphql';
import type { remoteAccessApprovalApiServiceCreateMutation as CreateMutation } from '@/__generated__/remoteAccessApprovalApiServiceCreateMutation.graphql';
import type { remoteAccessApprovalApiServiceRequestQuery as RequestQuery } from '@/__generated__/remoteAccessApprovalApiServiceRequestQuery.graphql';
import type { remoteAccessApprovalApiServiceRevokeMutation as RevokeMutation } from '@/__generated__/remoteAccessApprovalApiServiceRevokeMutation.graphql';
import { getRelayEnvironment } from '@/lib/relay';
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
 * The real approval API (saas-tenant PR #3241 + saas-lib PR #885): the
 * technician side is GraphQL on openframe-saas-api - `createRemoteAccessRequest`,
 * `remoteAccessRequest(requestId)` for the 2 s poll and `revokeRemoteAccessRequest`
 * - run imperatively on the app's Relay environment (admin session, the same
 * `/api/graphql` endpoint as every other query). `deviceId` is the OpenFrame
 * machine id (the backend resolves the machine, its mesh node and organization
 * from it), which is what the device pages carry as `?id=`.
 *
 * Create returns `created: true` for a new request and `false` with the
 * technician's own live request (a page reload re-attaches without a second
 * end-user prompt) - both are the same answer here. Domain refusals come back
 * as `userErrors[].code` (another technician's request or session, an
 * undeliverable request, the feature switched off), mapped to
 * `RemoteAccessCreateError`. The decision push is not part of this service: it
 * arrives as a flat REMOTE_ACCESS_DECISION event on the technician's
 * notification subject, which `useRemoteAccessApproval` subscribes to
 * (see `parseRemoteAccessDecisionEvent`); `onDecision` is therefore a no-op here.
 */

/** Every operation reads the whole request; `@inline` because the reader is a service, not a component. */
const requestFragment = graphql`
  fragment remoteAccessApprovalApiService_request on RemoteAccessRequest @inline {
    requestId
    deviceId
    technicianId
    status
    mode
    decisionSource
    reason
    ticketId
    ticketNumber
    recordingEnabled
    createdAt
    deliveredAt
    expiresAt
    resolvedAt
  }
`;

const createMutation = graphql`
  mutation remoteAccessApprovalApiServiceCreateMutation($input: CreateRemoteAccessRequestInput!) {
    createRemoteAccessRequest(input: $input) {
      request {
        ...remoteAccessApprovalApiService_request
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const requestQuery = graphql`
  query remoteAccessApprovalApiServiceRequestQuery($requestId: String!) {
    remoteAccessRequest(requestId: $requestId) {
      ...remoteAccessApprovalApiService_request
    }
  }
`;

const revokeMutation = graphql`
  mutation remoteAccessApprovalApiServiceRevokeMutation($requestId: String!) {
    revokeRemoteAccessRequest(requestId: $requestId) {
      userErrors {
        code
        message
      }
    }
  }
`;

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
/** A revoke of an already settled request: the outcome is the same, nothing left to cancel. */
const REVOKE_SETTLED_CODE = 'REMOTE_ACCESS_REQUEST_SETTLED';

type Raw = Record<string, unknown>;

function text(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * `Instant` is an untyped scalar for Relay: it arrives as an ISO-8601 string
 * (Spring's default), but a numeric epoch (seconds, possibly fractional, or
 * milliseconds) is accepted too, so a Jackson setting on one host cannot
 * silently break the countdown.
 */
function timestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1e12 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  return undefined;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  return value === null ? null : timestamp(value);
}

function oneOf<T extends string>(value: unknown, allowed: ReadonlySet<string>): T | undefined {
  return typeof value === 'string' && allowed.has(value) ? (value as T) : undefined;
}

/** The wire request (the fragment's data) -> the app's read model. Throws on a body without the required fields. */
export function fromWireRemoteAccessRequest(data: WireRequest): RemoteAccessRequest {
  const status = oneOf<RemoteAccessRequestStatus>(data.status, STATUSES);
  if (!data.requestId || !status) {
    throw new Error('Malformed remote access request from the server');
  }
  return {
    requestId: data.requestId,
    deviceId: data.deviceId,
    // The wire kind is the enum `DESKTOP`; the app keeps its own lower-case kind.
    sessionKind: 'desktop',
    status,
    reason: data.reason ?? undefined,
    ticketId: data.ticketId ?? undefined,
    ticketNumber: data.ticketNumber ?? undefined,
    mode: oneOf<RemoteAccessMode>(data.mode, MODES),
    decisionSource:
      data.decisionSource === null ? null : oneOf<RemoteAccessDecisionSource>(data.decisionSource, DECISION_SOURCES),
    technicianId: data.technicianId,
    recordingEnabled: data.recordingEnabled === true,
    createdAt: timestamp(data.createdAt) ?? new Date().toISOString(),
    expiresAt: timestamp(data.expiresAt) ?? new Date().toISOString(),
    deliveredAt: nullableTimestamp(data.deliveredAt),
    resolvedAt: nullableTimestamp(data.resolvedAt),
  };
}

function readRequest(ref: WireRequestKey): RemoteAccessRequest {
  return fromWireRemoteAccessRequest(readInlineData(requestFragment, ref));
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
    deliveredAt: nullableTimestamp(raw.deliveredAt),
    resolvedAt: nullableTimestamp(raw.resolvedAt),
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

interface WireUserError {
  readonly code: string;
  readonly message: string;
}

function createErrorFrom(errors: ReadonlyArray<WireUserError>): RemoteAccessCreateError {
  const first = errors[0];
  const code = oneOf<RemoteAccessCreateErrorCode>(first?.code, CREATE_ERROR_CODES);
  const message = first?.message || 'Remote access request failed';
  return new RemoteAccessCreateError(code ?? 'UNKNOWN', message);
}

/** `commitMutation` as a promise: GraphQL-level errors reject, the payload resolves. */
function commit<TMutation extends MutationParameters>(
  mutation: GraphQLTaggedNode,
  variables: TMutation['variables'],
): Promise<TMutation['response']> {
  return new Promise((resolve, reject) => {
    commitMutation<TMutation>(getRelayEnvironment(), {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        if (errors?.length) reject(new Error(errors[0].message));
        else resolve(response);
      },
      onError: reject,
    });
  });
}

export class RemoteAccessApprovalApiService implements IRemoteAccessApprovalService {
  async create(input: CreateRemoteAccessRequestInput): Promise<RemoteAccessRequest> {
    const payload = await commit<CreateMutation>(createMutation, {
      input: {
        deviceId: input.deviceId,
        sessionKind: 'DESKTOP',
        reason: input.reason || null,
        ticketId: input.ticketId || null,
      },
    });
    const { request, userErrors } = payload.createRemoteAccessRequest;
    if (userErrors.length > 0 || !request) throw createErrorFrom(userErrors);
    return readRequest(request);
  }

  async get(requestId: string): Promise<RemoteAccessRequest> {
    const data = await fetchQuery<RequestQuery>(
      getRelayEnvironment(),
      requestQuery,
      { requestId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.remoteAccessRequest) throw new Error('Remote access request not found');
    return readRequest(data.remoteAccessRequest);
  }

  async revoke(requestId: string): Promise<void> {
    const payload = await commit<RevokeMutation>(revokeMutation, { requestId });
    const blocking = payload.revokeRemoteAccessRequest.userErrors.filter(e => e.code !== REVOKE_SETTLED_CODE);
    if (blocking.length > 0) throw new Error(blocking[0].message || 'Could not cancel the remote access request');
  }

  onDecision(): () => void {
    // The push channel is the NATS notification subject, subscribed in the hook.
    return () => {};
  }
}

export const remoteAccessApprovalApiService = new RemoteAccessApprovalApiService();
