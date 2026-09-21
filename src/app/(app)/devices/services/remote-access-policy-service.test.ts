import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TENANT_REMOTE_ACCESS_POLICY, remoteAccessPolicyService } from './remote-access-policy-service';

// The mock is a module singleton, so each test works on its own ids to stay
// independent of overrides other tests left behind.
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

/** Awaits a service call under fake timers by draining the mock latency. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(300);
  return promise;
}

describe('MockRemoteAccessPolicyService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the default tenant policy', async () => {
    const policy = await settle(remoteAccessPolicyService.getTenantPolicy());
    expect(policy).toEqual(DEFAULT_TENANT_REMOTE_ACCESS_POLICY);
  });

  it('persists a tenant policy update', async () => {
    const before = await settle(remoteAccessPolicyService.getTenantPolicy());
    await settle(remoteAccessPolicyService.updateTenantPolicy({ ...before, mode: 'NOTIFY_ONLY' }));
    const after = await settle(remoteAccessPolicyService.getTenantPolicy());
    expect(after.mode).toBe('NOTIFY_ONLY');
    // Restore the shared singleton for the other tests.
    await settle(remoteAccessPolicyService.updateTenantPolicy(before));
  });

  it('resolves the tenant mode when no override exists', async () => {
    const mode = await settle(remoteAccessPolicyService.resolveDeviceMode(nextId('dev'), nextId('org')));
    const tenant = await settle(remoteAccessPolicyService.getTenantPolicy());
    expect(mode).toBe(tenant.mode);
  });

  it('organization override wins over the tenant default', async () => {
    const orgId = nextId('org');
    await settle(remoteAccessPolicyService.setOrganizationMode(orgId, 'NOTIFY_ONLY'));
    expect(await settle(remoteAccessPolicyService.resolveDeviceMode(nextId('dev'), orgId))).toBe('NOTIFY_ONLY');
  });

  it('device override wins over the organization override', async () => {
    const orgId = nextId('org');
    const deviceId = nextId('dev');
    await settle(remoteAccessPolicyService.setOrganizationMode(orgId, 'NOTIFY_ONLY'));
    await settle(remoteAccessPolicyService.setDeviceMode(deviceId, 'DENY_ACCESS'));
    expect(await settle(remoteAccessPolicyService.resolveDeviceMode(deviceId, orgId))).toBe('DENY_ACCESS');
  });

  it('clearing a device override falls back to inheritance', async () => {
    const deviceId = nextId('dev');
    await settle(remoteAccessPolicyService.setDeviceMode(deviceId, 'SILENT_ACCESS'));
    expect(await settle(remoteAccessPolicyService.getDeviceMode(deviceId))).toBe('SILENT_ACCESS');
    await settle(remoteAccessPolicyService.setDeviceMode(deviceId, null));
    expect(await settle(remoteAccessPolicyService.getDeviceMode(deviceId))).toBeNull();
    const tenant = await settle(remoteAccessPolicyService.getTenantPolicy());
    expect(await settle(remoteAccessPolicyService.resolveDeviceMode(deviceId))).toBe(tenant.mode);
  });
});
