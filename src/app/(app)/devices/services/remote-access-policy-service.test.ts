import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TENANT_REMOTE_ACCESS_POLICY,
  mockRemoteAccessPolicyService as service,
} from './remote-access-policy-service';

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
    const policy = await settle(service.getTenantPolicy());
    expect(policy).toEqual(DEFAULT_TENANT_REMOTE_ACCESS_POLICY);
  });

  it('persists a tenant policy update', async () => {
    const before = await settle(service.getTenantPolicy());
    await settle(service.updateTenantPolicy({ ...before, mode: 'NOTIFY_ONLY' }));
    const after = await settle(service.getTenantPolicy());
    expect(after.mode).toBe('NOTIFY_ONLY');
    // Restore the shared singleton for the other tests.
    await settle(service.updateTenantPolicy(before));
  });

  it('an organization without an override inherits the tenant default', async () => {
    const tenant = await settle(service.getTenantPolicy());
    const policy = await settle(service.getOrganizationPolicy(nextId('org')));
    expect(policy).toEqual({ mode: null, effectiveMode: tenant.mode });
  });

  it('a device without overrides resolves to the tenant scope', async () => {
    const tenant = await settle(service.getTenantPolicy());
    const policy = await settle(service.getDevicePolicy(nextId('dev'), nextId('org')));
    expect(policy).toEqual({ mode: null, effectiveMode: tenant.mode, effectiveScope: 'TENANT' });
  });

  it('organization override wins over the tenant default', async () => {
    const orgId = nextId('org');
    const saved = await settle(service.setOrganizationMode(orgId, 'NOTIFY_ONLY'));
    expect(saved).toEqual({ mode: 'NOTIFY_ONLY', effectiveMode: 'NOTIFY_ONLY' });
    const device = await settle(service.getDevicePolicy(nextId('dev'), orgId));
    expect(device).toEqual({ mode: null, effectiveMode: 'NOTIFY_ONLY', effectiveScope: 'ORGANIZATION' });
  });

  it('device override wins over the organization override', async () => {
    const orgId = nextId('org');
    const deviceId = nextId('dev');
    await settle(service.setOrganizationMode(orgId, 'NOTIFY_ONLY'));
    const saved = await settle(service.setDeviceMode(deviceId, 'DENY_ACCESS', orgId));
    expect(saved).toEqual({ mode: 'DENY_ACCESS', effectiveMode: 'DENY_ACCESS', effectiveScope: 'DEVICE' });
  });

  it('clearing a device override falls back to inheritance', async () => {
    const deviceId = nextId('dev');
    await settle(service.setDeviceMode(deviceId, 'SILENT_ACCESS'));
    expect((await settle(service.getDevicePolicy(deviceId))).mode).toBe('SILENT_ACCESS');
    const cleared = await settle(service.setDeviceMode(deviceId, null));
    const tenant = await settle(service.getTenantPolicy());
    expect(cleared).toEqual({ mode: null, effectiveMode: tenant.mode, effectiveScope: 'TENANT' });
  });

  it('reads a page of devices in one call, each resolved through its own scopes', async () => {
    const orgId = nextId('org');
    const denied = nextId('dev');
    const inheriting = nextId('dev');
    await settle(service.setOrganizationMode(orgId, 'NOTIFY_ONLY'));
    await settle(service.setDeviceMode(denied, 'DENY_ACCESS', orgId));
    const policies = await settle(
      service.getDevicePolicies([
        { deviceId: denied, organizationId: orgId },
        { deviceId: inheriting, organizationId: orgId },
      ]),
    );
    expect(policies.get(denied)).toEqual({
      mode: 'DENY_ACCESS',
      effectiveMode: 'DENY_ACCESS',
      effectiveScope: 'DEVICE',
    });
    expect(policies.get(inheriting)).toEqual({
      mode: null,
      effectiveMode: 'NOTIFY_ONLY',
      effectiveScope: 'ORGANIZATION',
    });
  });
});
