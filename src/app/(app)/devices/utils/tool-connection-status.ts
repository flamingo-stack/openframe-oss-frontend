import type { ToolConnection } from '../types/device.types';

export type ToolConnectionDisplayStatus = 'online' | 'offline' | 'pending';

/**
 * Display status for a FLEET_MDM / MESHCENTRAL tool connection.
 *
 * The backend creates the ToolConnection row only once the agent reports its tool id,
 * so a missing row (or missing agentToolId) means the agent is still installing or
 * registering - PENDING, not offline. With an id present, `status` already carries the
 * live probe result ('online' / 'offline' / 'mia' from Fleet, 'online' / 'offline' from
 * the MeshCentral deviceStatus call) enriched in use-device-details.
 */
export function getToolConnectionDisplayStatus(
  connection: ToolConnection | null | undefined,
): ToolConnectionDisplayStatus {
  if (!connection?.agentToolId) return 'pending';
  return connection.status?.toLowerCase() === 'online' ? 'online' : 'offline';
}
