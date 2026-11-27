import { type DeviceStatusDisplay, isManagedStatus } from '@flamingo-stack/openframe-frontend-core/components/features';

/**
 * How the device page's header states the device's lifecycle (Figma 5108:198472, "Devices - Status tag + Outdated").
 * In the lifecycle display a managed device carries no tag beside its title: the subtitle says "Managed · Updated …",
 * as its grid card says "Managed · Last seen …". Every other status keeps its tag, and so does the legacy display,
 * whose tag (ONLINE / OFFLINE) is its only connectivity signal. `updated` is the subtitle without the lifecycle
 * ("Updated 3 days ago"), or nothing when the device never reported.
 */
export function deviceHeaderStatus(
  status: string | null | undefined,
  display: DeviceStatusDisplay,
  updated: string | undefined,
): { tag: boolean; subtitle: string | undefined } {
  if (display !== 'lifecycle' || !isManagedStatus(status)) return { tag: true, subtitle: updated };
  return { tag: false, subtitle: updated ? `Managed · ${updated}` : 'Managed' };
}
