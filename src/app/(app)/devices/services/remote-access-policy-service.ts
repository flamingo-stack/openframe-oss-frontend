import type {
  DeviceRemoteAccessPolicy,
  OrganizationRemoteAccessPolicy,
  RemoteAccessMode,
  TenantRemoteAccessPolicy,
} from '../types/remote-access';

/**
 * The remote access policy as the settings screens and the connect flow read
 * it: one mode per scope, the effective mode resolved device -> organization
 * -> tenant on the server. Implemented by `RemoteAccessPolicyApiService`
 * (remote-access-policy-api-service.ts) on openframe-saas-api.
 */
export interface IRemoteAccessPolicyService {
  getTenantPolicy(): Promise<TenantRemoteAccessPolicy>;
  updateTenantPolicy(policy: TenantRemoteAccessPolicy): Promise<TenantRemoteAccessPolicy>;
  getOrganizationPolicy(organizationId: string): Promise<OrganizationRemoteAccessPolicy>;
  /** `null` clears the override: the organization inherits the tenant default again. */
  setOrganizationMode(organizationId: string, mode: RemoteAccessMode | null): Promise<OrganizationRemoteAccessPolicy>;
  /** The device's override and its effective mode. */
  getDevicePolicy(deviceId: string): Promise<DeviceRemoteAccessPolicy>;
  /**
   * The same read for a page of table rows in one request, keyed by device id.
   * A device the server no longer knows is left out of the map.
   */
  getDevicePolicies(deviceIds: ReadonlyArray<string>): Promise<Map<string, DeviceRemoteAccessPolicy>>;
  /** `null` clears the override. Answers with the device's policy after the write. */
  setDeviceMode(deviceId: string, mode: RemoteAccessMode | null): Promise<DeviceRemoteAccessPolicy>;
}
