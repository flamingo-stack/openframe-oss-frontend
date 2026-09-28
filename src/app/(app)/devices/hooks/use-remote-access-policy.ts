'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEVICES_PAGE_SIZE } from '../queries/devices-api';
import type { Device } from '../types/device.types';
import type {
  DeviceRemoteAccessPolicy,
  OrganizationRemoteAccessPolicy,
  RemoteAccessMode,
  TenantRemoteAccessPolicy,
} from '../types/remote-access';
import { useRemoteAccessApprovalGate } from './use-remote-access-approval-gate';
import { useRemoteAccessPolicyService } from './use-remote-access-policy-service';

/**
 * Keyed by backend as well: the mock and the API must never share a cache
 * entry, since the flag that picks between them can answer after a first read.
 */
export const remoteAccessPolicyKeys = {
  all: ['remote-access-policy'] as const,
  backend: (isMock: boolean) => [...remoteAccessPolicyKeys.all, isMock ? 'mock' : 'api'] as const,
  tenant: (isMock: boolean) => [...remoteAccessPolicyKeys.backend(isMock), 'tenant'] as const,
  organization: (isMock: boolean, organizationId: string) =>
    [...remoteAccessPolicyKeys.backend(isMock), 'organization', organizationId] as const,
  device: (isMock: boolean, deviceId: string) =>
    [...remoteAccessPolicyKeys.backend(isMock), 'device', deviceId] as const,
  rows: (isMock: boolean, deviceIds: readonly string[]) =>
    [...remoteAccessPolicyKeys.backend(isMock), 'rows', ...deviceIds] as const,
};

export function useTenantRemoteAccessPolicy(options: { enabled?: boolean } = {}) {
  const { service, isMock, ready } = useRemoteAccessPolicyService();
  return useQuery({
    queryKey: remoteAccessPolicyKeys.tenant(isMock),
    queryFn: () => service.getTenantPolicy(),
    enabled: ready && (options.enabled ?? true),
  });
}

/** Silent mutation - the caller owns toast feedback (AI Settings tab pattern). */
export function useUpdateTenantRemoteAccessPolicy() {
  const queryClient = useQueryClient();
  const { service, isMock } = useRemoteAccessPolicyService();
  return useMutation({
    mutationFn: (policy: TenantRemoteAccessPolicy) => service.updateTenantPolicy(policy),
    onSuccess: saved => {
      queryClient.setQueryData(remoteAccessPolicyKeys.tenant(isMock), saved);
      // The tenant default feeds every effective mode below it.
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.all });
    },
  });
}

/** Per-organization override (`mode` null = inherits the tenant default) plus the effective mode. */
export function useOrganizationRemoteAccessPolicy(organizationId: string, options: { enabled?: boolean } = {}) {
  const { service, isMock, ready } = useRemoteAccessPolicyService();
  return useQuery({
    queryKey: remoteAccessPolicyKeys.organization(isMock, organizationId),
    queryFn: () => service.getOrganizationPolicy(organizationId),
    enabled: ready && (options.enabled ?? true) && !!organizationId,
  });
}

/** Silent mutation - the caller owns toast feedback. `null` clears the override. */
export function useSetOrganizationRemoteAccessMode() {
  const queryClient = useQueryClient();
  const { service, isMock } = useRemoteAccessPolicyService();
  return useMutation({
    mutationFn: ({ organizationId, mode }: { organizationId: string; mode: RemoteAccessMode | null }) =>
      service.setOrganizationMode(organizationId, mode),
    onSuccess: (saved: OrganizationRemoteAccessPolicy, { organizationId }) => {
      queryClient.setQueryData(remoteAccessPolicyKeys.organization(isMock, organizationId), saved);
      // The org mode feeds every device's effective mode under it.
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.all });
    },
  });
}

/**
 * Per-device override (`mode` null = inherits) plus the effective mode and its
 * scope. `organizationId` only matters to the mock, which walks the scopes
 * itself; the API resolves them on the server.
 */
export function useDeviceRemoteAccessPolicy(
  deviceId: string,
  options: { enabled?: boolean; organizationId?: string } = {},
) {
  const { service, isMock, ready } = useRemoteAccessPolicyService();
  return useQuery({
    queryKey: remoteAccessPolicyKeys.device(isMock, deviceId),
    queryFn: () => service.getDevicePolicy(deviceId, options.organizationId),
    enabled: ready && (options.enabled ?? true) && !!deviceId,
  });
}

/** Silent mutation - the caller owns toast feedback. `null` clears the override. */
export function useSetDeviceRemoteAccessMode() {
  const queryClient = useQueryClient();
  const { service, isMock } = useRemoteAccessPolicyService();
  return useMutation({
    mutationFn: ({
      deviceId,
      mode,
      organizationId,
    }: {
      deviceId: string;
      mode: RemoteAccessMode | null;
      organizationId?: string;
    }) => service.setDeviceMode(deviceId, mode, organizationId),
    onSuccess: (saved: DeviceRemoteAccessPolicy, { deviceId }) => {
      queryClient.setQueryData(remoteAccessPolicyKeys.device(isMock, deviceId), saved);
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.device(isMock, deviceId) });
    },
  });
}

/**
 * Reads the policy of a device table's rows, one request per page of rows, and
 * files each answer under that device's own key - where the row menus below
 * and the Edit Device modal already look. Pages are cut at the list's own page
 * size: the list only ever grows at the end, so loading the next page adds a
 * request instead of re-reading the ones above it.
 */
export function useRowRemoteAccessPolicies(
  devices: ReadonlyArray<Pick<Device, 'machineId' | 'id' | 'organizationId'>>,
) {
  const gate = useRemoteAccessApprovalGate();
  const queryClient = useQueryClient();
  const { service, isMock, ready } = useRemoteAccessPolicyService();

  // Only rows with a machine id: the read addresses them as `Machine:<machineId>`.
  const refs = devices
    .filter(device => !!device.machineId)
    .map(device => ({ deviceId: device.machineId, organizationId: device.organizationId }));
  const pages: (typeof refs)[] = [];
  for (let start = 0; start < refs.length; start += DEVICES_PAGE_SIZE) {
    pages.push(refs.slice(start, start + DEVICES_PAGE_SIZE));
  }

  useQueries({
    queries: pages.map(page => ({
      queryKey: remoteAccessPolicyKeys.rows(
        isMock,
        page.map(ref => ref.deviceId),
      ),
      queryFn: async () => {
        const policies = await service.getDevicePolicies(page);
        for (const [deviceId, policy] of policies) {
          queryClient.setQueryData(remoteAccessPolicyKeys.device(isMock, deviceId), policy);
        }
        return policies.size;
      },
      enabled: ready && gate === 'on',
    })),
  });
}

/**
 * Effective remote access mode for a device (device -> organization -> tenant),
 * gated on the `remote-access-approval` feature flag. Returns `undefined`
 * while the gate/query is loading or when the feature is off - callers treat
 * that as "no policy restriction" so the legacy behavior is untouched.
 *
 * `context: 'row'` (a device table row) never reads on its own: the table
 * reads its rows a page at a time (`useRowRemoteAccessPolicies`) into the same
 * cache entry this watches. A row the table has not read yet stays
 * unrestricted, and the connect flow still answers DENY_ACCESS on entry.
 */
export function useEffectiveDeviceRemoteAccessMode(
  device: Pick<Device, 'machineId' | 'id' | 'organizationId'> | null | undefined,
  options: { context?: 'page' | 'row' } = {},
): RemoteAccessMode | undefined {
  const gate = useRemoteAccessApprovalGate();
  const deviceId = device?.machineId || device?.id || '';

  const { data } = useDeviceRemoteAccessPolicy(deviceId, {
    enabled: gate === 'on' && options.context !== 'row',
    organizationId: device?.organizationId,
  });

  return gate === 'on' ? data?.effectiveMode : undefined;
}
