'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { remoteAccessPolicyService } from '../services/remote-access-policy-service';
import type { Device } from '../types/device.types';
import type { RemoteAccessMode, TenantRemoteAccessPolicy } from '../types/remote-access';
import { useRemoteAccessApprovalGate } from './use-remote-access-approval-gate';

export const remoteAccessPolicyKeys = {
  all: ['remote-access-policy'] as const,
  tenant: () => [...remoteAccessPolicyKeys.all, 'tenant'] as const,
  organization: (organizationId: string) => [...remoteAccessPolicyKeys.all, 'organization', organizationId] as const,
  device: (deviceId: string) => [...remoteAccessPolicyKeys.all, 'device', deviceId] as const,
  deviceEffective: (deviceId: string, organizationId?: string) =>
    [...remoteAccessPolicyKeys.all, 'device-effective', deviceId, organizationId ?? ''] as const,
};

export function useTenantRemoteAccessPolicy(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: remoteAccessPolicyKeys.tenant(),
    queryFn: () => remoteAccessPolicyService.getTenantPolicy(),
    enabled: options.enabled ?? true,
  });
}

/** Silent mutation - the caller owns toast feedback (AI Settings tab pattern). */
export function useUpdateTenantRemoteAccessPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policy: TenantRemoteAccessPolicy) => remoteAccessPolicyService.updateTenantPolicy(policy),
    onSuccess: () => {
      // The tenant default feeds every effective-mode resolution below it.
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.all });
    },
  });
}

/** Per-organization override (`null` = inherits the tenant default). */
export function useOrganizationRemoteAccessMode(organizationId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: remoteAccessPolicyKeys.organization(organizationId),
    queryFn: () => remoteAccessPolicyService.getOrganizationMode(organizationId),
    enabled: (options.enabled ?? true) && !!organizationId,
  });
}

/** Per-device override (`null` = inherits organization/tenant). */
export function useDeviceRemoteAccessMode(deviceId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: remoteAccessPolicyKeys.device(deviceId),
    queryFn: () => remoteAccessPolicyService.getDeviceMode(deviceId),
    enabled: (options.enabled ?? true) && !!deviceId,
  });
}

/** Silent mutation - the caller owns toast feedback. */
export function useSetDeviceRemoteAccessMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, mode }: { deviceId: string; mode: RemoteAccessMode | null }) =>
      remoteAccessPolicyService.setDeviceMode(deviceId, mode),
    onSuccess: (_, { deviceId }) => {
      void queryClient.invalidateQueries({ queryKey: remoteAccessPolicyKeys.device(deviceId) });
      // Effective-mode keys embed the org id too; invalidate by the shared prefix.
      void queryClient.invalidateQueries({ queryKey: [...remoteAccessPolicyKeys.all, 'device-effective', deviceId] });
    },
  });
}

/**
 * Effective remote access mode for a device (device -> organization -> tenant),
 * gated on the `remote-access-approval` feature flag. Returns `undefined`
 * while the gate/query is loading or when the feature is off - callers treat
 * that as "no policy restriction" so the legacy behavior is untouched.
 */
export function useEffectiveDeviceRemoteAccessMode(
  device: Pick<Device, 'machineId' | 'id' | 'organizationId'> | null | undefined,
): RemoteAccessMode | undefined {
  const gate = useRemoteAccessApprovalGate();
  const deviceId = device?.machineId || device?.id || '';
  const organizationId = device?.organizationId;

  const { data } = useQuery({
    queryKey: remoteAccessPolicyKeys.deviceEffective(deviceId, organizationId),
    queryFn: () => remoteAccessPolicyService.resolveDeviceMode(deviceId, organizationId),
    enabled: gate === 'on' && !!deviceId,
  });

  return gate === 'on' ? data : undefined;
}
