import { useMemo } from 'react';
import { DEVICE_ENRICHMENT_FILTER } from '../../../devices/constants/device-statuses';
import { useAllDevices } from '../../../devices/hooks/use-all-devices';
import { indexDevicesByFleetHostId } from '../../../devices/utils/device-action-utils';
import type { ComplianceStatus, PolicyDeviceRow } from '../types/policy-device-row';
import { usePolicyResponseHosts } from './use-policy-response-hosts';

export function usePolicyDevicesTable(
  policyId: number | null,
  assignedHostIds?: Array<{ id: number; hostname: string }>,
) {
  const { hosts: failingHosts, isLoading: isLoadingFailing } = usePolicyResponseHosts(policyId, 'failing');
  const { hosts: passingHosts, isLoading: isLoadingPassing } = usePolicyResponseHosts(policyId, 'passing');

  const {
    devices,
    isLoading: isLoadingDevices,
    error: devicesError,
  } = useAllDevices({ filter: DEVICE_ENRICHMENT_FILTER });

  const rows: PolicyDeviceRow[] = useMemo(() => {
    // The policy's assigned hosts are the source of truth for WHICH devices
    // appear; Fleet's failing/passing membership only supplies their status.
    // Fleet keeps a host's last policy response until its next check-in, so an
    // unassigned host can still come back as failing/passing - without this
    // filter it would linger in the table as a stale "Non-Compliant" row.
    const assignedIds = new Set((assignedHostIds ?? []).map(h => h.id));
    const statusMap = new Map<number, ComplianceStatus>();
    for (const host of failingHosts) {
      if (assignedIds.has(host.id)) statusMap.set(host.id, 'non-compliant');
    }
    for (const host of passingHosts) {
      if (assignedIds.has(host.id) && !statusMap.has(host.id)) statusMap.set(host.id, 'passing');
    }
    for (const host of assignedHostIds ?? []) {
      if (!statusMap.has(host.id)) statusMap.set(host.id, 'pending');
    }

    const deviceByFleetId = indexDevicesByFleetHostId(devices);

    const fleetHostMap = new Map<number, { hostname: string; display_name: string }>();
    for (const h of failingHosts) fleetHostMap.set(h.id, h);
    for (const h of passingHosts) {
      if (!fleetHostMap.has(h.id)) fleetHostMap.set(h.id, h);
    }
    if (assignedHostIds) {
      for (const h of assignedHostIds) {
        if (!fleetHostMap.has(h.id)) fleetHostMap.set(h.id, { hostname: h.hostname, display_name: h.hostname });
      }
    }

    const result: PolicyDeviceRow[] = [];
    for (const [fleetId, status] of statusMap) {
      const device = deviceByFleetId.get(fleetId);
      const host = fleetHostMap.get(fleetId);
      result.push({
        id: String(fleetId),
        hostname: device?.hostname || host?.hostname || `Host ${fleetId}`,
        displayName:
          device?.displayName || device?.hostname || host?.display_name || host?.hostname || `Host ${fleetId}`,
        deviceType: device?.type,
        organization: device?.organization,
        organizationImageUrl: device?.organizationImageUrl,
        organizationImageHash: device?.organizationImageHash,
        osType: device?.osType,
        complianceStatus: status,
        machineId: device?.machineId,
        fleetHostId: fleetId,
      });
    }

    const statusOrder: Record<ComplianceStatus, number> = { 'non-compliant': 0, pending: 1, passing: 2 };
    result.sort((a, b) => {
      if (a.complianceStatus !== b.complianceStatus) {
        return statusOrder[a.complianceStatus] - statusOrder[b.complianceStatus];
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return result;
  }, [devices, failingHosts, passingHosts, assignedHostIds]);

  return {
    rows,
    isLoading: isLoadingFailing || isLoadingPassing || isLoadingDevices,
    error: devicesError,
  };
}
