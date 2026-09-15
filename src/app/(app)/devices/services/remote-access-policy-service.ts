// Remote access policy service (CU-86akeqw8b).
//
// Backs the policy settings UI while the BE policy task (CU-86akeqw6h) is in
// design: one `RemoteAccessMode` per scope with device -> organization ->
// tenant resolution, plus the tenant-level approval tuning (timeouts and
// fallbacks). Swapping to the real API is one new implementation of
// `IRemoteAccessPolicyService`.

import type { RemoteAccessMode, TenantRemoteAccessPolicy } from '../types/remote-access';

export interface IRemoteAccessPolicyService {
  getTenantPolicy(): Promise<TenantRemoteAccessPolicy>;
  updateTenantPolicy(policy: TenantRemoteAccessPolicy): Promise<TenantRemoteAccessPolicy>;
  /** Per-organization override; `null` = the organization inherits the tenant default. */
  getOrganizationMode(organizationId: string): Promise<RemoteAccessMode | null>;
  setOrganizationMode(organizationId: string, mode: RemoteAccessMode | null): Promise<void>;
  /** Per-device override; `null` = the device inherits its organization/tenant mode. */
  getDeviceMode(deviceId: string): Promise<RemoteAccessMode | null>;
  setDeviceMode(deviceId: string, mode: RemoteAccessMode | null): Promise<void>;
  /** Effective mode for a device: device override -> organization override -> tenant default. */
  resolveDeviceMode(deviceId: string, organizationId?: string): Promise<RemoteAccessMode>;
}

export const DEFAULT_TENANT_REMOTE_ACCESS_POLICY: TenantRemoteAccessPolicy = {
  mode: 'APPROVAL_REQUIRED',
  approvalTimeoutSeconds: 60,
  deliveryTimeoutSeconds: 5,
  noClientFallback: 'DENY',
  noAnswerFallback: 'DENY',
  reasonRequired: true,
};

const MOCK_LATENCY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * In-memory mock. State lives for the SPA session (like the approval-service
 * mock) - enough to exercise every screen and the DENY_ACCESS action gating
 * end to end before the BE exists.
 */
class MockRemoteAccessPolicyService implements IRemoteAccessPolicyService {
  private tenantPolicy: TenantRemoteAccessPolicy = { ...DEFAULT_TENANT_REMOTE_ACCESS_POLICY };
  private readonly organizationModes = new Map<string, RemoteAccessMode>();
  private readonly deviceModes = new Map<string, RemoteAccessMode>();

  async getTenantPolicy(): Promise<TenantRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    return { ...this.tenantPolicy };
  }

  async updateTenantPolicy(policy: TenantRemoteAccessPolicy): Promise<TenantRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    this.tenantPolicy = { ...policy };
    return { ...this.tenantPolicy };
  }

  async getOrganizationMode(organizationId: string): Promise<RemoteAccessMode | null> {
    await delay(MOCK_LATENCY_MS);
    return this.organizationModes.get(organizationId) ?? null;
  }

  async setOrganizationMode(organizationId: string, mode: RemoteAccessMode | null): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    if (mode === null) {
      this.organizationModes.delete(organizationId);
    } else {
      this.organizationModes.set(organizationId, mode);
    }
  }

  async getDeviceMode(deviceId: string): Promise<RemoteAccessMode | null> {
    await delay(MOCK_LATENCY_MS);
    return this.deviceModes.get(deviceId) ?? null;
  }

  async setDeviceMode(deviceId: string, mode: RemoteAccessMode | null): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    if (mode === null) {
      this.deviceModes.delete(deviceId);
    } else {
      this.deviceModes.set(deviceId, mode);
    }
  }

  async resolveDeviceMode(deviceId: string, organizationId?: string): Promise<RemoteAccessMode> {
    await delay(MOCK_LATENCY_MS);
    const deviceMode = this.deviceModes.get(deviceId);
    if (deviceMode) return deviceMode;
    const organizationMode = organizationId ? this.organizationModes.get(organizationId) : undefined;
    if (organizationMode) return organizationMode;
    return this.tenantPolicy.mode;
  }
}

export const remoteAccessPolicyService: IRemoteAccessPolicyService = new MockRemoteAccessPolicyService();
