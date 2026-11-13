import { isVersionBelow } from '@/lib/app-version';
import type { Device } from '../types/device.types';

/** Devices whose OpenFrame client is older than this are asked to re-install it. */
export const MIN_CLIENT_VERSION = '1.6.0';

const OPENFRAME_CLIENT_AGENT_TYPE = 'openframe-client';

/**
 * The OpenFrame client's version: the agent registry's first, then the machine's own.
 * `Machine.agentVersion` is written only when the agent registers, while a client that
 * updates itself reports its new version to the registry (`installedAgents`), so after a
 * self-update only the registry is current.
 */
export function openframeClientVersion(device: Pick<Device, 'installedAgents' | 'agentVersion'>): string | undefined {
  return (
    device.installedAgents?.find(agent => agent.agentType === OPENFRAME_CLIENT_AGENT_TYPE)?.version ||
    device.agentVersion
  );
}

/** Below `MIN_CLIENT_VERSION`. A version that does not parse (none, `unknown`, a bare hash) is never outdated. */
export function isClientOutdated(device: Pick<Device, 'installedAgents' | 'agentVersion'>): boolean {
  return isVersionBelow(openframeClientVersion(device), MIN_CLIENT_VERSION);
}
