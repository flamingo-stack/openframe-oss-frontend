/**
 * Device Action Utilities
 * Unified logic for determining device action availability
 */

import type { Device, ToolConnection } from '../types/device.types';

/**
 * Check if a device is online (case-insensitive)
 */
export function isDeviceOnline(status: string | undefined): boolean {
  return status?.toUpperCase() === 'ONLINE';
}

/**
 * Check if a device can be archived
 */
export function canArchiveDevice(status: string | undefined): boolean {
  const upperStatus = status?.toUpperCase();
  return upperStatus !== 'ARCHIVED' && upperStatus !== 'DELETED';
}

/**
 * Check if a device can be unarchived (restored from the archive)
 */
export function canUnarchiveDevice(status: string | undefined): boolean {
  return status?.toUpperCase() === 'ARCHIVED';
}

/**
 * Check if a device can be deleted
 */
export function canDeleteDevice(status: string | undefined): boolean {
  return status?.toUpperCase() !== 'DELETED';
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
 * Get Fleet MDM host ID (numeric) from device tool connections
 */
export function getFleetHostId(device: Device): number | undefined {
  const connection = getToolConnection(device.toolConnections, 'FLEET_MDM');
  if (!connection?.agentToolId) return undefined;
  const id = Number(connection.agentToolId);
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
  archiveEnabled: boolean;
  unarchiveEnabled: boolean;
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
  const isOnline = isDeviceOnline(device.status);

  const meshcentralReady = Boolean(meshcentralAgentId) && isOnline && !meshcentralOffline;

  return {
    remoteShellEnabled: meshcentralReady,
    remoteControlEnabled: meshcentralReady,
    manageFilesEnabled: meshcentralReady,

    // Reboot goes through the MeshCentral control socket (poweraction/reset),
    // so it has the same requirements as the other remote actions.
    rebootEnabled: meshcentralReady,

    // Run Script (native scripts-v2 flow): only requires the device to be online.
    // TODO(openframe-rmm): gate on an OpenFrame RMM agent once run-script is wired.
    runScriptEnabled: isOnline,

    // Archive: device must not be already archived or deleted
    archiveEnabled: canArchiveDevice(device.status),

    // Unarchive: only archived devices can be restored
    unarchiveEnabled: canUnarchiveDevice(device.status),

    // Delete: device must not be already deleted
    deleteEnabled: canDeleteDevice(device.status),

    // Pass through tool IDs for handlers
    meshcentralAgentId,

    // Device state
    isOnline,
  };
}
