import type { Device, ToolConnection } from '../types/device.types';

export type ToolConnectionDisplayStatus = 'online' | 'offline' | 'pending';

/**
 * Lifecycle state of a FLEET_MDM / MESHCENTRAL tool connection.
 *
 * BE contract: the ToolConnection row is created only when the agent reports its
 * tool id (status=CONNECTED and connectedAt stamped together at that moment), and
 * at most one row exists per toolType. So a missing row / missing agentToolId
 * means the agent is still installing or registering — never "offline". A
 * DISCONNECTED (or ERROR) row is a torn-down connection: its agentToolId may be
 * stale, so callers must not probe or open tunnels with it.
 */
export type ToolConnectionState = 'pending' | 'disconnected' | 'live';

export function getToolConnectionState(connection: ToolConnection | null | undefined): ToolConnectionState {
  if (!connection?.agentToolId) return 'pending';
  const raw = connection.status?.toUpperCase();
  if (raw === 'DISCONNECTED' || raw === 'ERROR') return 'disconnected';
  return 'live';
}

/**
 * Display status for the Agents tab. With an id present, `status` carries the
 * live probe result ('online' / 'offline' / 'mia' from Fleet, 'online' /
 * 'offline' from the MeshCentral deviceStatus call) enriched in
 * use-device-details; a raw DISCONNECTED/ERROR row renders as offline.
 */
export function getToolConnectionDisplayStatus(
  connection: ToolConnection | null | undefined,
): ToolConnectionDisplayStatus {
  if (getToolConnectionState(connection) === 'pending') return 'pending';
  return connection?.status?.toLowerCase() === 'online' ? 'online' : 'offline';
}

/**
 * Statuses that mean the device record is a (future) archive — a missing tool
 * connection there is teardown, not a first-time install, so no "still
 * connecting" messaging applies.
 */
const NON_CONNECTING_DEVICE_STATUSES = new Set(['ARCHIVED', 'DELETED', 'PENDING_DELETION', 'DECOMMISSIONED']);

/**
 * True while the device is waiting for its first Fleet or MeshCentral
 * registration — drives the "Device is still connecting" banner. Shows only
 * until the first connect (a later reconnect keeps its row, so it never
 * re-triggers), and never on archive-lifecycle records.
 */
export function isDeviceStillConnecting(device: Device): boolean {
  if (NON_CONNECTING_DEVICE_STATUSES.has(device.status?.toUpperCase() ?? '')) return false;
  const fleet = device.toolConnections?.find(tc => tc.toolType === 'FLEET_MDM');
  const mesh = device.toolConnections?.find(tc => tc.toolType === 'MESHCENTRAL');
  return getToolConnectionState(fleet) === 'pending' || getToolConnectionState(mesh) === 'pending';
}

/**
 * Blocked-state copy for the remote surfaces (shell / desktop / file manager)
 * when the MeshCentral connection is not usable ('pending' or 'disconnected').
 */
export function getMeshCentralBlockedCopy(
  state: ToolConnectionState,
  feature: string,
): { title: string; description: string } {
  if (state === 'pending') {
    return {
      title: 'MeshCentral agent is still installing',
      description: `${feature} will be available once the agent finishes installing and connects.`,
    };
  }
  return {
    title: 'MeshCentral agent is disconnected',
    description: `${feature} requires the MeshCentral agent to be connected.`,
  };
}
