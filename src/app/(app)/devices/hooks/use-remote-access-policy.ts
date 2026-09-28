'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEVICES_PAGE_SIZE } from '../queries/devices-api';
import { remoteAccessPolicyApiService as service } from '../services/remote-access-policy-api-service';
import type { Device } from '../types/device.types';
import type {
  DeviceRemoteAccessPolicy,
  OrganizationRemoteAccessPolicy,
  RemoteAccessMode,
  TenantRemoteAccessPolicy,
} from '../types/remote-access';
import { useRemoteAccessApprovalGate } from './use-remote-access-approval-gate';

export const remoteAccessPolicyKeys = {
  all: ['remote-access-policy'] as const,
  tenant: () => [...remoteAccessPolicyKeys.all, 'tenant'] as const,
  organization: (organizationId: string) => [...remoteAccessPolicyKeys.all, 'organization', organizationId] as const,
  device: (deviceId: string) => [...remoteAccessPolicyKeys.all, 'device', deviceId] as const,
  rows: (deviceIds: readonly string[]) => [...remoteAccessPolicyKeys.all, 'rows', ...deviceIds] as const,
};

export function useTenantRemoteAccessPolicy(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: remoteAccessPolicyKeys.tenant(),
    queryFn: () => service.getTenantPolicy(),
    enabled: options.enabled ?? true,
  });
}

/** Silent mutation - the caller owns toast feedback (AI Settings tab pattern). */
export function useUpdateTenantRemoteAccessPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policy: TenantRemoteAccessPolicy) => service.updateTenantPolicy(policy),
    onSuccess: saved => {
      queryClient.setQueryData(remoteAccessPolicyKeys.tenant(), saved);
      // The tenant default feeds every effective mode below it.
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.all });
    },
  });
}

/** Per-organization override (`mode` null = inherits the tenant default) plus the effective mode. */
export function useOrganizationRemoteAccessPolicy(organizationId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: remoteAccessPolicyKeys.organization(organizationId),
    queryFn: () => service.getOrganizationPolicy(organizationId),
    enabled: (options.enabled ?? true) && !!organizationId,
  });
}

/** Silent mutation - the caller owns toast feedback. `null` clears the override. */
export function useSetOrganizationRemoteAccessMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, mode }: { organizationId: string; mode: RemoteAccessMode | null }) =>
      service.setOrganizationMode(organizationId, mode),
    onSuccess: (saved: OrganizationRemoteAccessPolicy, { organizationId }) => {
      queryClient.setQueryData(remoteAccessPolicyKeys.organization(organizationId), saved);
      // The org mode feeds every device's effective mode under it.
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.all });
    },
  });
}

/** Per-device override (`mode` null = inherits) plus the effective mode and its scope. */
export function useDeviceRemoteAccessPolicy(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: remoteAccessPolicyKeys.device(deviceId),
    queryFn: () => service.getDevicePolicy(deviceId),
    enabled: (options.enabled ?? true) && !!deviceId,
  });
}

/** Silent mutation - the caller owns toast feedback. `null` clears the override. */
export function useSetDeviceRemoteAccessMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, mode }: { deviceId: string; mode: RemoteAccessMode | null }) =>
      service.setDeviceMode(deviceId, mode),
    onSuccess: (saved: DeviceRemoteAccessPolicy, { deviceId }) => {
      queryClient.setQueryData(remoteAccessPolicyKeys.device(deviceId), saved);
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.device(deviceId) });
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
export function useRowRemoteAccessPolicies(devices: ReadonlyArray<Pick<Device, 'machineId'>>) {
  const gate = useRemoteAccessApprovalGate();
  const queryClient = useQueryClient();

  // Only rows with a machine id: the read addresses them as `Machine:<machineId>`.
  const deviceIds = devices.map(device => device.machineId).filter(Boolean);
  const pages: string[][] = [];
  for (let start = 0; start < deviceIds.length; start += DEVICES_PAGE_SIZE) {
    pages.push(deviceIds.slice(start, start + DEVICES_PAGE_SIZE));
  }

  useQueries({
    queries: pages.map(page => ({
      queryKey: remoteAccessPolicyKeys.rows(page),
      queryFn: async () => {
        const policies = await service.getDevicePolicies(page);
        for (const [deviceId, policy] of policies) {
          queryClient.setQueryData(remoteAccessPolicyKeys.device(deviceId), policy);
        }
        return policies.size;
      },
      enabled: gate === 'on',
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
  device: Pick<Device, 'machineId' | 'id'> | null | undefined,
  options: { context?: 'page' | 'row' } = {},
): RemoteAccessMode | undefined {
  const gate = useRemoteAccessApprovalGate();
  const deviceId = device?.machineId || device?.id || '';

  const { data } = useDeviceRemoteAccessPolicy(deviceId, { enabled: gate === 'on' && options.context !== 'row' });

  return gate === 'on' ? data?.effectiveMode : undefined;
}
