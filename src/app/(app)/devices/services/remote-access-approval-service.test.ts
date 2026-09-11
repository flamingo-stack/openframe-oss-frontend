import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteAccessRequest } from '../types/remote-access';
import { mockRemoteAccessDecision, remoteAccessApprovalService } from './remote-access-approval-service';

// The mock is a module singleton, so each test works on its own deviceId to
// stay independent of requests other tests left behind.
let deviceSeq = 0;
const nextDeviceId = () => `dev-${++deviceSeq}`;

async function createRequest(deviceId: string): Promise<RemoteAccessRequest> {
  const promise = remoteAccessApprovalService.create({ deviceId, sessionKind: 'desktop', reason: 'test' });
  await vi.advanceTimersByTimeAsync(400);
  return promise;
}

describe('MockRemoteAccessApprovalService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a PENDING request that expires 60s out', async () => {
    const request = await createRequest(nextDeviceId());
    expect(request.status).toBe('PENDING');
    expect(Date.parse(request.expiresAt) - Date.parse(request.createdAt)).toBe(60_000);
  });

  it('moves to DELIVERED after the client ack window', async () => {
    const request = await createRequest(nextDeviceId());
    await vi.advanceTimersByTimeAsync(1_500);
    const currentPromise = remoteAccessApprovalService.get(request.requestId);
    await vi.advanceTimersByTimeAsync(400);
    expect((await currentPromise).status).toBe('DELIVERED');
  });

  it('auto-settles as TIMED_OUT at expiry and notifies the subscriber', async () => {
    const request = await createRequest(nextDeviceId());
    const seen: string[] = [];
    remoteAccessApprovalService.onDecision(request.requestId, r => seen.push(r.status));
    await vi.advanceTimersByTimeAsync(61_000);
    expect(seen).toContain('TIMED_OUT');
  });

  it('returns the existing open request instead of creating a second one', async () => {
    const deviceId = nextDeviceId();
    const first = await createRequest(deviceId);
    const second = await createRequest(deviceId);
    expect(second.requestId).toBe(first.requestId);
  });

  it('allows a new request after the previous one settles', async () => {
    const deviceId = nextDeviceId();
    const first = await createRequest(deviceId);
    mockRemoteAccessDecision(first.requestId, 'DENIED');
    const second = await createRequest(deviceId);
    expect(second.requestId).not.toBe(first.requestId);
    expect(second.status).toBe('PENDING');
  });

  it('revoke settles the request as REVOKED and ignores later decisions', async () => {
    const request = await createRequest(nextDeviceId());
    const seen: string[] = [];
    remoteAccessApprovalService.onDecision(request.requestId, r => seen.push(r.status));

    const revokePromise = remoteAccessApprovalService.revoke(request.requestId);
    await vi.advanceTimersByTimeAsync(400);
    await revokePromise;
    expect(seen).toEqual(['REVOKED']);

    // A repeat decision on a settled request is a no-op (the API's 409).
    mockRemoteAccessDecision(request.requestId, 'APPROVED');
    expect(seen).toEqual(['REVOKED']);
  });

  it('delivers an APPROVED decision to subscribers exactly once', async () => {
    const request = await createRequest(nextDeviceId());
    const seen: string[] = [];
    remoteAccessApprovalService.onDecision(request.requestId, r => seen.push(r.status));
    mockRemoteAccessDecision(request.requestId, 'APPROVED');
    mockRemoteAccessDecision(request.requestId, 'APPROVED');
    expect(seen).toEqual(['APPROVED']);
    // The timeout sweep must not fire on a settled request.
    await vi.advanceTimersByTimeAsync(61_000);
    expect(seen).toEqual(['APPROVED']);
  });
});
