/**
 * Device Action Utilities
 * Unified logic for determining device action availability
 */

import { isDeviceConnected, isManagedStatus } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { Device, ToolConnection } from '../types/device.types';
import { getToolConnectionState } from './tool-connection-status';

/**
 * Whether a device is online right now: its `connectivity`, never its lifecycle status (null reads as offline).
 */
export function isDeviceOnline(connectivity: string | null | undefined): boolean {
  return isDeviceConnected(connectivity);
}

/**
 * Whether remote actions (shell, desktop, files, reboot, run script) can reach the device: it is managed (MANAGED,
 * or the legacy ONLINE / OFFLINE) and online right now. A PENDING device is refused by the backend's dispatch even
 * when it is online, so the UI disables it the same way; its details page says it is still connecting.
 */
export function canRunRemoteActions(device: Pick<Device, 'status' | 'connectivity'>): boolean {
  return isManagedStatus(device.status) && isDeviceOnline(device.connectivity);
}

/**
 * Check if a device can be deleted. Deletion is final: a DELETED device is a
 * read-only archive record, and PENDING_DELETION already has an uninstall
 * scheduled.
 */
export function canDeleteDevice(status: string | undefined): boolean {
  const upperStatus = status?.toUpperCase();
  return upperStatus !== 'DELETED' && upperStatus !== 'PENDING_DELETION';
}

/**
 * Check if a device's display name can be edited. DELETED devices (and legacy
 * ARCHIVED ones) are read-only archive records - no edits of any kind - and a
 * PENDING_DELETION device is already on its way there (per design).
 */
export function canEditDisplayName(status: string | undefined): boolean {
  const upperStatus = status?.toUpperCase();
  return upperStatus !== 'DELETED' && upperStatus !== 'ARCHIVED' && upperStatus !== 'PENDING_DELETION';
}

/**
 * Get tool connection by type
 */
export function getToolConnection(
  toolConnections: ToolConnection[] | undefined,
  toolType: 'MESHCENTRAL' | 'FLEET_MDM',
): ToolConnection | undefined {
  return toolConnections?.find(tc => tc.toolType === toolType);
}

/**
 * Get MeshCentral agent ID
 */
export function getMeshCentralAgentId(device: Device): string | undefined {
  return getToolConnection(device.toolConnections, 'MESHCENTRAL')?.agentToolId;
}

/**
 * Get Fleet MDM host ID (numeric) from device tool connections.
 *
 * Only a live connection yields an id: a DISCONNECTED row may carry a stale
 * Fleet host id, and treating it as targetable would surface torn-down devices
 * in the monitoring/onboarding pickers and live-query campaigns.
 */
export function getFleetHostId(device: Device): number | undefined {
  const connection = getToolConnection(device.toolConnections, 'FLEET_MDM');
  if (getToolConnectionState(connection) !== 'live') return undefined;
  const id = Number(connection?.agentToolId);
  return isNaN(id) ? undefined : id;
}

/**
 * Index devices by their Fleet host id, for the screens that start from a Fleet
 * host (monitoring queries and policies) and need the OpenFrame device behind it.
 *
 * Several devices can carry the same Fleet host id — a machine re-enrolled under
 * a new device record keeps the old one's connection — so the most recently seen
 * device wins. Devices with no Fleet connection are absent from the map.
 */
export function indexDevicesByFleetHostId(devices: readonly Device[]): Map<number, Device> {
  const byFleetId = new Map<number, Device>();

  for (const device of devices) {
    const fleetId = getFleetHostId(device);
    if (fleetId === undefined) continue;

    const existing = byFleetId.get(fleetId);
    if (!existing || lastSeenTime(device) > lastSeenTime(existing)) {
      byFleetId.set(fleetId, device);
    }
  }

  return byFleetId;
}

function lastSeenTime(device: Device): number {
  return new Date(device.lastSeen || device.last_seen || 0).getTime();
}

/**
 * Device action availability result
 */
export interface DeviceActionAvailability {
  // Action enabled states
  remoteShellEnabled: boolean;
  remoteControlEnabled: boolean;
  manageFilesEnabled: boolean;
  runScriptEnabled: boolean;
  rebootEnabled: boolean;
  editDisplayNameEnabled: boolean;
  deleteEnabled: boolean;

  // Tool IDs (for handlers)
  meshcentralAgentId: string | undefined;

  // Device state
  isOnline: boolean;
}

/**
 * Get unified device action availability
 * Single source of truth for all action enabled/disabled states
 */
export function getDeviceActionAvailability(device: Device): DeviceActionAvailability {
  const meshcentralConnection = getToolConnection(device.toolConnections, 'MESHCENTRAL');
  const meshcentralAgentId = meshcentralConnection?.agentToolId;
  const meshcentralOffline = meshcentralConnection?.status?.toLowerCase() === 'offline';
  const isOnline = isDeviceOnline(device.connectivity);
  const reachable = canRunRemoteActions(device);

  // 'live' covers the id-presence check and additionally blocks DISCONNECTED/ERROR
  // rows, whose stale agentToolId must not open tunnels.
  const meshcentralReady = getToolConnectionState(meshcentralConnection) === 'live' && reachable && !meshcentralOffline;

  return {
    remoteShellEnabled: meshcentralReady,
    remoteControlEnabled: meshcentralReady,
    manageFilesEnabled: meshcentralReady,

    // Reboot goes through the MeshCentral control socket (poweraction/reset),
    // so it has the same requirements as the other remote actions.
    rebootEnabled: meshcentralReady,

    // Run Script (native Scripts flow): a managed device that is online right now.
    // TODO(openframe-rmm): gate on an OpenFrame RMM agent once run-script is wired.
    runScriptEnabled: reachable,

    // Edit Display Name: blocked on read-only archive records
    editDisplayNameEnabled: canEditDisplayName(device.status),

    // Delete: device must not be already deleted
    deleteEnabled: canDeleteDevice(device.status),

    // Pass through tool IDs for handlers
    meshcentralAgentId,

    // Device state
    isOnline,
  };
}
