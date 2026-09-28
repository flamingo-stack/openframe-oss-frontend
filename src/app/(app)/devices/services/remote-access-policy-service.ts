import type {
  DeviceRemoteAccessPolicy,
  OrganizationRemoteAccessPolicy,
  RemoteAccessMode,
  TenantRemoteAccessPolicy,
} from '../types/remote-access';

/**
 * The remote access policy as the settings screens and the connect flow read
 * it: one mode per scope, the effective mode resolved device -> organization
 * -> tenant. `RemoteAccessPolicyApiService` (remote-access-policy-api-service.ts)
 * is the real client on openframe-saas-api; `MockRemoteAccessPolicyService`
 * below stands in where the API is not deployed yet, and
 * `useRemoteAccessPolicyService` picks one by the `remote-access-approval-api`
 * flag - the same switch as the approval and session clients, because the
 * real approval resolves this policy on the server.
 */
export interface IRemoteAccessPolicyService {
  getTenantPolicy(): Promise<TenantRemoteAccessPolicy>;
  updateTenantPolicy(policy: TenantRemoteAccessPolicy): Promise<TenantRemoteAccessPolicy>;
  getOrganizationPolicy(organizationId: string): Promise<OrganizationRemoteAccessPolicy>;
  /** `null` clears the override: the organization inherits the tenant default again. */
  setOrganizationMode(organizationId: string, mode: RemoteAccessMode | null): Promise<OrganizationRemoteAccessPolicy>;
  /**
   * The device's override and its effective mode. `organizationId` is only
   * the mock's way to walk the scopes; the API resolves them on the server.
   */
  getDevicePolicy(deviceId: string, organizationId?: string): Promise<DeviceRemoteAccessPolicy>;
  /**
   * The same read for a page of table rows in one request, keyed by device id.
   * A device the server no longer knows is left out of the map.
   */
  getDevicePolicies(devices: ReadonlyArray<DevicePolicyRef>): Promise<Map<string, DeviceRemoteAccessPolicy>>;
  /** `null` clears the override. Answers with the device's policy after the write. */
  setDeviceMode(
    deviceId: string,
    mode: RemoteAccessMode | null,
    organizationId?: string,
  ): Promise<DeviceRemoteAccessPolicy>;
}

/** A device as the batch read takes it: its machine id, plus the organization only the mock uses. */
export interface DevicePolicyRef {
  deviceId: string;
  organizationId?: string;
}

export const DEFAULT_TENANT_REMOTE_ACCESS_POLICY: TenantRemoteAccessPolicy = {
  mode: 'APPROVAL_REQUIRED',
};

const MOCK_LATENCY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * In-memory mock. State lives for the SPA session (like the approval-service
 * mock) - enough to exercise every screen and the DENY_ACCESS action gating
 * end to end where the backend is not deployed.
 */
class MockRemoteAccessPolicyService implements IRemoteAccessPolicyService {
  private tenantPolicy: TenantRemoteAccessPolicy = { ...DEFAULT_TENANT_REMOTE_ACCESS_POLICY };
  private readonly organizationModes = new Map<string, RemoteAccessMode>();
  private readonly deviceModes = new Map<string, RemoteAccessMode>();

  private organization(organizationId: string): OrganizationRemoteAccessPolicy {
    const mode = this.organizationModes.get(organizationId) ?? null;
    return { mode, effectiveMode: mode ?? this.tenantPolicy.mode };
  }

  private device(deviceId: string, organizationId?: string): DeviceRemoteAccessPolicy {
    const mode = this.deviceModes.get(deviceId) ?? null;
    if (mode) return { mode, effectiveMode: mode, effectiveScope: 'DEVICE' };
    const organizationMode = organizationId ? this.organizationModes.get(organizationId) : undefined;
    if (organizationMode) return { mode: null, effectiveMode: organizationMode, effectiveScope: 'ORGANIZATION' };
    return { mode: null, effectiveMode: this.tenantPolicy.mode, effectiveScope: 'TENANT' };
  }

  async getTenantPolicy(): Promise<TenantRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    return { ...this.tenantPolicy };
  }

  async updateTenantPolicy(policy: TenantRemoteAccessPolicy): Promise<TenantRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    this.tenantPolicy = { ...policy };
    return { ...this.tenantPolicy };
  }

  async getOrganizationPolicy(organizationId: string): Promise<OrganizationRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    return this.organization(organizationId);
  }

  async setOrganizationMode(
    organizationId: string,
    mode: RemoteAccessMode | null,
  ): Promise<OrganizationRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    if (mode === null) {
      this.organizationModes.delete(organizationId);
    } else {
      this.organizationModes.set(organizationId, mode);
    }
    return this.organization(organizationId);
  }

  async getDevicePolicy(deviceId: string, organizationId?: string): Promise<DeviceRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    return this.device(deviceId, organizationId);
  }

  async getDevicePolicies(devices: ReadonlyArray<DevicePolicyRef>): Promise<Map<string, DeviceRemoteAccessPolicy>> {
    await delay(MOCK_LATENCY_MS);
    return new Map(devices.map(({ deviceId, organizationId }) => [deviceId, this.device(deviceId, organizationId)]));
  }

  async setDeviceMode(
    deviceId: string,
    mode: RemoteAccessMode | null,
    organizationId?: string,
  ): Promise<DeviceRemoteAccessPolicy> {
    await delay(MOCK_LATENCY_MS);
    if (mode === null) {
      this.deviceModes.delete(deviceId);
    } else {
      this.deviceModes.set(deviceId, mode);
    }
    return this.device(deviceId, organizationId);
  }
}

export const mockRemoteAccessPolicyService: IRemoteAccessPolicyService = new MockRemoteAccessPolicyService();
