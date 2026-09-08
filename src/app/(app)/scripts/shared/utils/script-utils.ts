import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import type { DeviceFilterInput } from '@/app/(app)/devices/types/device.types';

export { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '@/lib/platforms';

/**
 * The device filter a TEST-run picker offers: ONLINE only, because a test run
 * needs the machine reachable right now — narrower than `runDeviceFilter`, which
 * also offers offline devices. Shared by the v2 and legacy test modals.
 */
export function testDeviceFilter(supportedPlatforms: string[]): DeviceFilterInput {
  const osTypes = mapPlatformsToOsTypes(supportedPlatforms);
  return {
    statuses: [DEVICE_STATUS.ONLINE],
    ...(osTypes.length > 0 && { osTypes }),
  };
}

/**
 * The device filter a run-script picker offers: live machines whose OS the
 * script supports. Shared by the v2 and legacy run pages so the two can't drift
 * on which devices a script may be dispatched to.
 */
export function runDeviceFilter(supportedPlatforms: string[]): DeviceFilterInput {
  const osTypes = mapPlatformsToOsTypes(supportedPlatforms);
  return {
    statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE],
    ...(osTypes.length > 0 && { osTypes }),
  };
}

/**
 * Map supported_platforms from script to osTypes filter values
 * Script uses: 'windows', 'linux', 'darwin'
 * Device filter expects: 'WINDOWS', 'MAC_OS'
 */
export function mapPlatformsToOsTypes(platforms: string[]): string[] {
  const mapping: Record<string, string> = {
    windows: 'WINDOWS',
    darwin: 'MAC_OS',
  };

  return platforms.map(p => mapping[p.toLowerCase()]).filter((v): v is string => !!v);
}

export function mapPlatformsForDisplay(platforms: string[]): string[] {
  const mapping: Record<string, string> = {
    windows: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
  };

  return platforms.map(p => mapping[p.toLowerCase()]).filter((v): v is string => !!v);
}
