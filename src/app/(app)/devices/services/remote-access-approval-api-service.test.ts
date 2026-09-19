import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRemoteAccessRelayIdPrefix, RemoteAccessCreateError } from '../types/remote-access';
import {
  applyRemoteAccessDecisionEvent,
  normalizeRemoteAccessRequest,
  parseRemoteAccessDecisionEvent,
  RemoteAccessApprovalApiService,
} from './remote-access-approval-api-service';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post, get },
}));

const REQUEST_ID = '01J8ZQK3N5ABCDEFGHJKMNPQRS';

const wireRequest = (overrides: Record<string, unknown> = {}) => ({
  requestId: REQUEST_ID,
  deviceId: 'dev_7f3c',
  machineId: 'm_9b1e',
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
});

describe('RemoteAccessApprovalApiService', () => {
  const service = new RemoteAccessApprovalApiService();

  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('creates a request with the contract body and normalizes the 201', async () => {
    post.mockResolvedValue({ ok: true, status: 201, data: wireRequest() });
    const created = await service.create({
      deviceId: 'dev_7f3c',
      sessionKind: 'desktop',
      reason: 'Printer driver reinstall',
    });
    expect(post).toHaveBeenCalledWith('/api/v1/remote-access/requests', {
      deviceId: 'dev_7f3c',
      sessionKind: 'desktop',
      reason: 'Printer driver reinstall',
    });
    expect(created.requestId).toBe(REQUEST_ID);
    expect(created.status).toBe('PENDING');
    expect(created.mode).toBe('APPROVAL_REQUIRED');
    expect(created.decisionSource).toBeNull();
    expect(created.ticketNumber).toBe('1234');
  });

  it('does not send absent optionals and accepts the 200 re-attach as a normal answer', async () => {
    post.mockResolvedValue({ ok: true, status: 200, data: wireRequest({ status: 'DELIVERED' }) });
    const existing = await service.create({ deviceId: 'dev_7f3c', sessionKind: 'desktop', organizationId: 'org_1' });
    expect(post).toHaveBeenCalledWith('/api/v1/remote-access/requests', {
      deviceId: 'dev_7f3c',
      sessionKind: 'desktop',
    });
    expect(existing.status).toBe('DELIVERED');
  });

  it('turns the 409 codes and the 503 into typed create errors', async () => {
    post.mockResolvedValue({
      ok: false,
      status: 409,
      data: { code: 'DEVICE_HAS_LIVE_REQUEST', message: 'Another technician is waiting for approval on this device' },
      error: 'Another technician is waiting for approval on this device',
    });
    await expect(service.create({ deviceId: 'd', sessionKind: 'desktop' })).rejects.toMatchObject({
      name: 'RemoteAccessCreateError',
      code: 'DEVICE_HAS_LIVE_REQUEST',
      status: 409,
    });

    post.mockResolvedValue({ ok: false, status: 409, data: { code: 'DEVICE_HAS_ACTIVE_SESSION', message: 'busy' } });
    await expect(service.create({ deviceId: 'd', sessionKind: 'desktop' })).rejects.toMatchObject({
      code: 'DEVICE_HAS_ACTIVE_SESSION',
    });

    post.mockResolvedValue({ ok: false, status: 503, data: { code: 'DEVICE_UNREACHABLE', message: 'no broker' } });
    await expect(service.create({ deviceId: 'd', sessionKind: 'desktop' })).rejects.toMatchObject({
      code: 'DEVICE_UNREACHABLE',
    });

    // A 503 without a body still reads as unreachable; anything else is UNKNOWN.
    post.mockResolvedValue({ ok: false, status: 503, error: 'Service Unavailable' });
    await expect(service.create({ deviceId: 'd', sessionKind: 'desktop' })).rejects.toMatchObject({
      code: 'DEVICE_UNREACHABLE',
    });
    post.mockResolvedValue({
      ok: false,
      status: 404,
      data: { code: 'REMOTE_ACCESS_DISABLED', message: 'Remote access approval is disabled', status: 404 },
    });
    await expect(service.create({ deviceId: 'd', sessionKind: 'desktop' })).rejects.toMatchObject({
      code: 'REMOTE_ACCESS_DISABLED',
    });
    post.mockResolvedValue({ ok: false, status: 400, data: { message: 'deviceId is required' } });
    const unknown = await service.create({ deviceId: 'd', sessionKind: 'desktop' }).catch(e => e);
    expect(unknown).toBeInstanceOf(RemoteAccessCreateError);
    expect(unknown.code).toBe('UNKNOWN');
    expect(unknown.message).toBe('deviceId is required');
  });

  it('polls the request by id and rejects on a failed GET', async () => {
    get.mockResolvedValue({ ok: true, status: 200, data: wireRequest({ status: 'APPROVED', decisionSource: 'USER' }) });
    const current = await service.get(REQUEST_ID);
    expect(get).toHaveBeenCalledWith(`/api/v1/remote-access/requests/${REQUEST_ID}`);
    expect(current.status).toBe('APPROVED');
    expect(current.decisionSource).toBe('USER');

    get.mockResolvedValue({ ok: false, status: 404, error: 'Unknown request' });
    await expect(service.get(REQUEST_ID)).rejects.toThrow('Unknown request');
  });

  it('revokes and treats an already-settled 409 as done', async () => {
    post.mockResolvedValue({ ok: true, status: 200, data: wireRequest({ status: 'REVOKED' }) });
    await expect(service.revoke(REQUEST_ID)).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith(`/api/v1/remote-access/requests/${REQUEST_ID}/revoke`);

    post.mockResolvedValue({ ok: false, status: 409, data: wireRequest({ status: 'APPROVED' }) });
    await expect(service.revoke(REQUEST_ID)).resolves.toBeUndefined();

    post.mockResolvedValue({ ok: false, status: 403, error: 'Not the caller' });
    await expect(service.revoke(REQUEST_ID)).rejects.toThrow('Not the caller');
  });
});

describe('normalizeRemoteAccessRequest', () => {
  it('reads ISO timestamps and tolerates numeric epochs in seconds or millis', () => {
    const iso = normalizeRemoteAccessRequest(wireRequest());
    expect(iso.createdAt).toBe('2026-09-15T09:15:02Z');
    const seconds = normalizeRemoteAccessRequest(
      wireRequest({ createdAt: 1789463702.5, expiresAt: 1789463762, deliveredAt: null, recordingEnabled: true }),
    );
    expect(seconds.createdAt).toBe('2026-09-15T09:15:02.500Z');
    expect(seconds.expiresAt).toBe('2026-09-15T09:16:02.000Z');
    expect(seconds.deliveredAt).toBeNull();
    expect(seconds.recordingEnabled).toBe(true);
    const millis = normalizeRemoteAccessRequest(wireRequest({ createdAt: 1789463702500 }));
    expect(millis.createdAt).toBe('2026-09-15T09:15:02.500Z');
  });

  it('accepts the mock-era resolvedMode name and rejects a body without id or status', () => {
    expect(normalizeRemoteAccessRequest(wireRequest({ mode: undefined, resolvedMode: 'NOTIFY_ONLY' })).mode).toBe(
      'NOTIFY_ONLY',
    );
    expect(() => normalizeRemoteAccessRequest({ requestId: REQUEST_ID })).toThrow();
    expect(() => normalizeRemoteAccessRequest({ status: 'PENDING' })).toThrow();
    expect(() => normalizeRemoteAccessRequest(wireRequest({ status: 'WEIRD' }))).toThrow();
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
    const pending = normalizeRemoteAccessRequest(wireRequest());
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
