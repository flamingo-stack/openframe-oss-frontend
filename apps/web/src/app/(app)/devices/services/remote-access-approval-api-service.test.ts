import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { remoteAccessApprovalApiService_request$data as WireRequest } from '@/__generated__/remoteAccessApprovalApiService_request.graphql';
import { buildRemoteAccessRelayIdPrefix, RemoteAccessCreateError } from '../types/remote-access';
import {
  applyRemoteAccessDecisionEvent,
  fromWireRemoteAccessRequest,
  parseRemoteAccessDecisionEvent,
  RemoteAccessApprovalApiService,
} from './remote-access-approval-api-service';

type MutationConfig = {
  variables: Record<string, unknown>;
  onCompleted: (response: unknown, errors: ReadonlyArray<{ message: string }> | null) => void;
  onError: (error: Error) => void;
};

const relay = vi.hoisted(() => ({
  commitMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  commitMutation: relay.commitMutation,
  fetchQuery: relay.fetchQuery,
}));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
// `@inline` fragments are read with `readInlineData`; the wire objects below stand in for the ref.
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const REQUEST_ID = '01J8ZQK3N5ABCDEFGHJKMNPQRS';

/** The fragment's data as the server sends it; `Instant` is untyped, so epochs are allowed too. */
const wireRequest = (overrides: Record<string, unknown> = {}): WireRequest =>
  ({
    requestId: REQUEST_ID,
    deviceId: 'dev_7f3c',
    sessionKind: 'desktop',
    status: 'PENDING',
    mode: 'APPROVAL_REQUIRED',
    decisionSource: null,
    reason: 'Printer driver reinstall',
    ticketId: 't_2a91',
    ticketNumber: '1234',
    technicianId: 'u_91c',
    createdAt: '2026-09-15T09:15:02Z',
    deliveredAt: null,
    expiresAt: '2026-09-15T09:16:02Z',
    resolvedAt: null,
    ...overrides,
  }) as unknown as WireRequest;

const service = new RemoteAccessApprovalApiService();

const WIRE_REQUEST = {
  requestId: '01M2TFW3CCTSKAXWRSP84605F4',
  deviceId: 'machine-1',
  technicianId: 'tech-1',
  sessionKind: 'DESKTOP',
  status: 'PENDING',
  mode: 'APPROVAL_REQUIRED',
  decisionSource: null,
  reason: null,
  ticketId: null,
  ticketNumber: null,
  recordingEnabled: true,
  createdAt: '2026-09-15T09:15:02Z',
  deliveredAt: null,
  expiresAt: '2026-09-15T09:15:32Z',
  resolvedAt: null,
};

/** The next mutation completes with `response` (or a GraphQL-level error). */
function completeMutationWith(response: unknown, errors: ReadonlyArray<{ message: string }> | null = null) {
  relay.commitMutation.mockImplementationOnce((_env: unknown, config: MutationConfig) => {
    config.onCompleted(response, errors);
    return { dispose: () => {} };
  });
}

function lastMutationVariables(): Record<string, unknown> {
  const call = relay.commitMutation.mock.calls.at(-1);
  return (call?.[1] as MutationConfig).variables;
}

describe('RemoteAccessApprovalApiService', () => {
  beforeEach(() => {
    relay.commitMutation.mockReset();
    relay.fetchQuery.mockReset();
  });

  it('creates a request with the wire input and normalizes a new request', async () => {
    completeMutationWith({
      createRemoteAccessRequest: { request: WIRE_REQUEST, userErrors: [] },
    });
    const request = await service.create({
      deviceId: 'machine-1',
      sessionKind: 'desktop',
      reason: 'Printer',
      ticketId: 't-1',
    });
    expect(lastMutationVariables()).toEqual({
      input: { deviceId: 'machine-1', sessionKind: 'DESKTOP', reason: 'Printer', ticketId: 't-1' },
    });
    expect(request).toMatchObject({
      requestId: WIRE_REQUEST.requestId,
      deviceId: 'machine-1',
      sessionKind: 'desktop',
      status: 'PENDING',
      mode: 'APPROVAL_REQUIRED',
      technicianId: 'tech-1',
      recordingEnabled: true,
      expiresAt: '2026-09-15T09:15:32Z',
    });
  });

  it('sends absent optionals as null and takes the re-attach as a normal answer', async () => {
    completeMutationWith({
      createRemoteAccessRequest: { request: { ...WIRE_REQUEST, status: 'DELIVERED' }, userErrors: [] },
    });
    const request = await service.create({ deviceId: 'machine-1', sessionKind: 'desktop' });
    expect(lastMutationVariables()).toEqual({
      input: { deviceId: 'machine-1', sessionKind: 'DESKTOP', reason: null, ticketId: null },
    });
    expect(request.status).toBe('DELIVERED');
  });

  it('turns the userErrors codes into typed create errors', async () => {
    const cases: Array<[string, string]> = [
      ['DEVICE_HAS_LIVE_REQUEST', 'DEVICE_HAS_LIVE_REQUEST'],
      ['DEVICE_HAS_ACTIVE_SESSION', 'DEVICE_HAS_ACTIVE_SESSION'],
      ['DEVICE_UNREACHABLE', 'DEVICE_UNREACHABLE'],
      ['REMOTE_ACCESS_DISABLED', 'REMOTE_ACCESS_DISABLED'],
      ['DEVICE_NOT_FOUND', 'UNKNOWN'],
    ];
    for (const [wire, expected] of cases) {
      completeMutationWith({
        createRemoteAccessRequest: {
          request: null,
          userErrors: [{ code: wire, message: `Refused: ${wire}` }],
        },
      });
      const error = await service.create({ deviceId: 'machine-1', sessionKind: 'desktop' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RemoteAccessCreateError);
      expect((error as RemoteAccessCreateError).code).toBe(expected);
      expect((error as RemoteAccessCreateError).message).toBe(`Refused: ${wire}`);
    }
  });

  it('rejects a create on a GraphQL-level error', async () => {
    completeMutationWith(null, [{ message: 'Unauthorized' }]);
    await expect(service.create({ deviceId: 'machine-1', sessionKind: 'desktop' })).rejects.toThrow('Unauthorized');
  });

  it('polls the request by id over the network and rejects when it is gone', async () => {
    relay.fetchQuery.mockReturnValueOnce({
      toPromise: () => Promise.resolve({ remoteAccessRequest: { ...WIRE_REQUEST, status: 'APPROVED' } }),
    });
    const request = await service.get(WIRE_REQUEST.requestId);
    expect(relay.fetchQuery.mock.calls[0][2]).toEqual({ requestId: WIRE_REQUEST.requestId });
    expect(relay.fetchQuery.mock.calls[0][3]).toEqual({ fetchPolicy: 'network-only' });
    expect(request.status).toBe('APPROVED');

    relay.fetchQuery.mockReturnValueOnce({ toPromise: () => Promise.reject(new Error('not found')) });
    await expect(service.get('missing')).rejects.toThrow('not found');
  });

  it('revokes, treats an already-settled request as done and surfaces other refusals', async () => {
    completeMutationWith({
      revokeRemoteAccessRequest: { userErrors: [] },
    });
    await expect(service.revoke('r1')).resolves.toBeUndefined();
    expect(lastMutationVariables()).toEqual({ requestId: 'r1' });

    completeMutationWith({
      revokeRemoteAccessRequest: {
        userErrors: [{ code: 'REMOTE_ACCESS_REQUEST_SETTLED', message: 'settled' }],
      },
    });
    await expect(service.revoke('r1')).resolves.toBeUndefined();

    completeMutationWith({
      revokeRemoteAccessRequest: {
        userErrors: [{ code: 'REMOTE_ACCESS_FORBIDDEN', message: 'not yours' }],
      },
    });
    await expect(service.revoke('r1')).rejects.toThrow('not yours');
  });
});

describe('fromWireRemoteAccessRequest', () => {
  it('reads ISO timestamps and tolerates numeric epochs in seconds or millis', () => {
    const iso = fromWireRemoteAccessRequest(wireRequest());
    expect(iso.createdAt).toBe('2026-09-15T09:15:02Z');
    const seconds = fromWireRemoteAccessRequest(
      wireRequest({ createdAt: 1789463702.5, expiresAt: 1789463762, deliveredAt: null, recordingEnabled: true }),
    );
    expect(seconds.createdAt).toBe('2026-09-15T09:15:02.500Z');
    expect(seconds.expiresAt).toBe('2026-09-15T09:16:02.000Z');
    expect(seconds.deliveredAt).toBeNull();
    expect(seconds.recordingEnabled).toBe(true);
    const millis = fromWireRemoteAccessRequest(wireRequest({ createdAt: 1789463702500 }));
    expect(millis.createdAt).toBe('2026-09-15T09:15:02.500Z');
  });

  it('rejects a body without id or status', () => {
    expect(() => fromWireRemoteAccessRequest(wireRequest({ requestId: '' }))).toThrow();
    expect(() => fromWireRemoteAccessRequest(wireRequest({ status: 'WHATEVER' }))).toThrow();
  });
});

describe('REMOTE_ACCESS_DECISION event', () => {
  it('parses only its own type with a known status', () => {
    expect(parseRemoteAccessDecisionEvent({ type: 'CLIENT_AI_MESSAGE', requestId: REQUEST_ID })).toBeNull();
    expect(
      parseRemoteAccessDecisionEvent({ type: 'REMOTE_ACCESS_DECISION', requestId: REQUEST_ID, status: 'PENDING' }),
    ).toBeNull();
    expect(parseRemoteAccessDecisionEvent('nope')).toBeNull();
    const event = parseRemoteAccessDecisionEvent({
      type: 'REMOTE_ACCESS_DECISION',
      requestId: REQUEST_ID,
      status: 'DENIED',
      decisionSource: 'FALLBACK',
      mode: 'APPROVAL_REQUIRED',
      deliveredAt: null,
      resolvedAt: '2026-09-15T09:15:40Z',
    });
    expect(event).toEqual({
      type: 'REMOTE_ACCESS_DECISION',
      requestId: REQUEST_ID,
      status: 'DENIED',
      decisionSource: 'FALLBACK',
      mode: 'APPROVAL_REQUIRED',
      deliveredAt: null,
      resolvedAt: '2026-09-15T09:15:40Z',
    });
  });

  it('merges DELIVERED and the settlement into the request without losing fields', () => {
    const pending = fromWireRemoteAccessRequest(wireRequest());
    const delivered = applyRemoteAccessDecisionEvent(pending, {
      type: 'REMOTE_ACCESS_DECISION',
      requestId: REQUEST_ID,
      status: 'DELIVERED',
      decisionSource: null,
      deliveredAt: '2026-09-15T09:15:05Z',
    });
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.deliveredAt).toBe('2026-09-15T09:15:05Z');
    expect(delivered.expiresAt).toBe(pending.expiresAt);
    const approved = applyRemoteAccessDecisionEvent(delivered, {
      type: 'REMOTE_ACCESS_DECISION',
      requestId: REQUEST_ID,
      status: 'APPROVED',
      decisionSource: 'USER',
      resolvedAt: '2026-09-15T09:15:40Z',
    });
    expect(approved).toMatchObject({ status: 'APPROVED', decisionSource: 'USER', deliveredAt: '2026-09-15T09:15:05Z' });
  });
});

describe('buildRemoteAccessRelayIdPrefix', () => {
  it('puts the request id first, then the Mesh protocol', () => {
    expect(buildRemoteAccessRelayIdPrefix(REQUEST_ID, 2)).toBe(`${REQUEST_ID}.2`);
  });
});
