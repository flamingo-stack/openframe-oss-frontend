import {
  type DeviceStatusDisplay,
  getDeviceConnectivityConfig,
  getDeviceLifecycleConfig,
  getDeviceName,
  getLegacyDeviceStatusConfig,
  isDeviceConnected,
  isManagedStatus,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import type { Device } from '@/app/(app)/devices/types/device.types';

/** Managed and online first, then managed and offline, then whatever is still enrolling or on its way out. */
function livenessRank(device: Device): number {
  if (!isManagedStatus(device.status)) return 2;
  return isDeviceConnected(device.connectivity) ? 0 : 1;
}

/**
 * The page's devices with the ones an agent is writing to first. A re-enrolled
 * laptop leaves its old records behind under the same hostname; the live one
 * is the pick that shows logs, so it should be the first of its namesakes.
 */
export function sortDevicesLiveFirst(devices: readonly Device[]): Device[] {
  return [...devices].sort((a, b) => livenessRank(a) - livenessRank(b));
}

/** A tag's label as a word: `PENDING DELETION` → `Pending deletion`. */
function asWord(label: string): string {
  const lower = label.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

/**
 * `Managed · Online` / `Pending deletion · Offline · 2 days ago` as words: the line is prose, not a tag. The legacy
 * display (`DeviceStatusDisplay`) says it the way it did before: `Online`, `Offline · 2 days ago`, `Pending`.
 */
function statusText(device: Device, display: DeviceStatusDisplay): string {
  const { online } = getDeviceConnectivityConfig(device.connectivity);
  const text =
    display === 'legacy'
      ? asWord(getLegacyDeviceStatusConfig(device.status, device.connectivity ?? null).label)
      : `${asWord(getDeviceLifecycleConfig(device.status).label)} · ${getDeviceConnectivityConfig(device.connectivity).label}`;
  // When it was last heard from tells an old registration apart from the live one;
  // an online device is being heard from now.
  return online || !device.lastSeen ? text : `${text} · ${formatRelativeTime(device.lastSeen)}`;
}

/**
 * A device as the picker offers it: its name, its machineId as the value. The
 * second line is what tells one entry from another when the fleet holds the
 * same hostname several times over (a laptop re-enrolled under another customer
 * keeps its old records): the hostname whenever the name is something else (a
 * nickname, say) — the log lines are tagged by hostname, so that is what the
 * reader matches a pick against — then the customer, then the status with the
 * last-seen time, so the record the agent is writing to stands out.
 */
export function toDeviceOption(device: Device, display: DeviceStatusDisplay = 'lifecycle'): AutocompleteOption {
  const label = getDeviceName(device) || device.machineId;
  const details = [
    device.hostname !== label ? device.hostname : '',
    device.organization,
    statusText(device, display),
  ].filter(Boolean);
  return {
    label,
    value: device.machineId,
    description: details.join(' · '),
  };
}
