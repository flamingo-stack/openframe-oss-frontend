import { isArchiveLifecycle } from '@flamingo-stack/openframe-frontend-core/components/features';
import { isManagedStatusSupported } from '@/lib/device-status-support';
import type { Device, ToolConnection, UnsupportedTool } from '../types/device.types';

/** 'not-supported': the device's OS version is below the agent's minimum, so it will never deploy there. */
export type ToolConnectionDisplayStatus = 'online' | 'offline' | 'pending' | 'not-supported';

/** An OS version as people write it: trailing `.0` parts dropped ("13.0" → "13", "11.7.10" unchanged). */
export function displayOsVersion(version: string): string {
  return version.replace(/(\.0+)+$/, '');
}

/**
 * The entry of `Machine.unsupportedTools` for a tool type, when the device's OS version is below that tool's
 * minimum. Undefined when the version is unknown, supported, or the backend does not report the field: all of
 * those keep today's behaviour.
 */
export function getUnsupportedTool(
  device: Pick<Device, 'unsupportedTools'> | null | undefined,
  toolType: string,
): UnsupportedTool | undefined {
  return device?.unsupportedTools?.find(tool => tool.toolType === toolType);
}

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
 * Agents the platform installs on every device, as `installedAgents.agentType`
 * values. Mirrors the enabled tool-agent configurations the backend installs on
 * registration (not exposed over GraphQL): Fleet and MeshCentral everywhere,
 * plus the openframe-chat app on SaaS tenants.
 */
const CORE_AGENT_TYPES = ['fleetmdm-agent', 'meshcentral-agent'] as const;
const SAAS_AGENT_TYPES = [...CORE_AGENT_TYPES, 'openframe-chat'] as const;

/**
 * Agents the Agents tab keeps a slot for, so one that has not reported yet
 * shows as pending instead of being absent. None on archive-lifecycle records:
 * a missing agent there is teardown, not an install in progress.
 */
export function getExpectedAgentTypes(device: Device, saasTenant: boolean): readonly string[] {
  if (isArchiveLifecycle(device)) return [];
  return saasTenant ? SAAS_AGENT_TYPES : CORE_AGENT_TYPES;
}

/**
 * True while the device is not fully connected yet — drives the "Device is still connecting" banner.
 *
 * A backend with the MANAGED status decides it: the device is PENDING until the agent, Fleet and MeshCentral have
 * all connected, then MANAGED for good, so the banner is `status === 'PENDING'` and the API, the filters and the
 * banner read one value (a Mac below Fleet's minimum is promoted without Fleet there). An older backend (no MANAGED)
 * has no such status, so the frontend works it out from the tool connections as before: waiting for the first Fleet
 * (unless its OS is below Fleet's minimum) or MeshCentral registration, never on archive-lifecycle records.
 */
export function isDeviceStillConnecting(device: Device): boolean {
  if (isManagedStatusSupported()) return device.status?.toUpperCase() === 'PENDING';
  if (isArchiveLifecycle(device)) return false;
  // The openframe-chat app has no tool connection to wait for, so it never holds the banner.
  // Fleet on an OS below its minimum will never register, so it does not hold the banner either.
  const fleet = device.toolConnections?.find(tc => tc.toolType === 'FLEET_MDM');
  const mesh = device.toolConnections?.find(tc => tc.toolType === 'MESHCENTRAL');
  const fleetPending = getToolConnectionState(fleet) === 'pending' && !getUnsupportedTool(device, 'FLEET_MDM');
  return fleetPending || getToolConnectionState(mesh) === 'pending';
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
