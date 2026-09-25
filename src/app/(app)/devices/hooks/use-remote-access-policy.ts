'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
 * Effective remote access mode for a device (device -> organization -> tenant),
 * gated on the `remote-access-approval` feature flag. Returns `undefined`
 * while the gate/query is loading or when the feature is off - callers treat
 * that as "no policy restriction" so the legacy behavior is untouched.
 *
 * `context: 'row'` (a device table row) skips the read against the real API:
 * that would be one request per row until the field rides in the list query
 * itself, and the connect flow answers DENY_ACCESS on entry anyway. The mock
 * reads it everywhere, as it always did.
 */
export function useEffectiveDeviceRemoteAccessMode(
  device: Pick<Device, 'machineId' | 'id' | 'organizationId'> | null | undefined,
  options: { context?: 'page' | 'row' } = {},
): RemoteAccessMode | undefined {
  const gate = useRemoteAccessApprovalGate();
  const { isMock } = useRemoteAccessPolicyService();
  const deviceId = device?.machineId || device?.id || '';
  const perRowOnApi = !isMock && options.context === 'row';

  const { data } = useDeviceRemoteAccessPolicy(deviceId, {
    enabled: gate === 'on' && !perRowOnApi,
    organizationId: device?.organizationId,
  });

  return gate === 'on' ? data?.effectiveMode : undefined;
}
