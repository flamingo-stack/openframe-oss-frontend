import type { Device } from '../types/device.types';
import { fleetTimestampMs } from './fleet-timestamp';

/**
 * Why the vulnerabilities list is empty — the decision table agreed with BE
 * (ClickUp 86ak6hzfx, vulnerability-tab-states-FE-spec.md), evaluated top down:
 *
 * 1. Fleet fan-out failed → 'error'
 * 2. Fleet connection torn down → 'disconnected' (dormant: BE hides such rows)
 * 3. Agent still registering, or the host never completed a software inventory
 *    scan → 'collecting' (nothing exists to match against yet)
 * 4. Matching never completed, or this device's software was inventoried AFTER
 *    the last completed matching run → 'scan-pending'
 * 5. Otherwise the last run covered this software → 'clean'
 *
 * The comparison can only ever err toward 'scan-pending' — it never claims
 * "clean" for software that was not matched (matching runs against the whole
 * catalogue, so a run newer than this host's inventory did cover it).
 */
export type VulnerabilitiesEmptyReason = 'error' | 'disconnected' | 'collecting' | 'scan-pending' | 'clean';

export function getVulnerabilitiesEmptyReason(device: Device): VulnerabilitiesEmptyReason {
  const fleetSource = device.sources?.fleet;
  if (fleetSource === 'error') return 'error';
  if (fleetSource === 'skipped-disconnected') return 'disconnected';
  if (fleetSource === 'skipped-pending') return 'collecting';

  const softwareAt = fleetTimestampMs(device.software_updated_at);
  if (softwareAt === null) return 'collecting';

  const fleet = device.toolConnections?.find(tc => tc.toolType === 'FLEET_MDM');
  const matchedAt = fleetTimestampMs(fleet?.vulnerabilitiesUpdatedAt);
  if (matchedAt === null || softwareAt > matchedAt) return 'scan-pending';

  return 'clean';
}
