import type { AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
import { getDeviceStatusConfig } from '@/app/(app)/devices/utils/device-status';

function statusLabel(device: Device): string {
  return getDeviceStatusConfig(device.status).label.toLowerCase();
}

/** Online first, then offline, then whatever is on its way out — the fleet's order reads by status name, which puts "pending deletion" on top. */
function livenessRank(device: Device): number {
  const label = statusLabel(device);
  if (label === 'online') return 0;
  if (label === 'offline') return 1;
  return 2;
}

/**
 * The page's devices with the ones an agent is writing to first. A re-enrolled
 * laptop leaves its old records behind under the same hostname; the live one
 * is the pick that shows logs, so it should be the first of its namesakes.
 */
export function sortDevicesLiveFirst(devices: readonly Device[]): Device[] {
  return [...devices].sort((a, b) => livenessRank(a) - livenessRank(b));
}

/** `ONLINE` / `PENDING DELETION` as a word: the line is prose, not a tag. */
function statusText(device: Device): string {
  const label = statusLabel(device);
  const text = label.charAt(0).toUpperCase() + label.slice(1);
  // When it was last heard from tells an old registration apart from the live one;
  // an online device is being heard from now.
  return label === 'online' || !device.lastSeen ? text : `${text} · ${formatRelativeTime(device.lastSeen)}`;
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
export function toDeviceOption(device: Device): AutocompleteOption {
  const label = getDeviceName(device) || device.machineId;
  const details = [device.hostname !== label ? device.hostname : '', device.organization, statusText(device)].filter(
    Boolean,
  );
  return {
    label,
    value: device.machineId,
    description: details.join(' · '),
  };
}
