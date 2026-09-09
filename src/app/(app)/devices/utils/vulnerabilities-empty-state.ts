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

  return isVulnerabilityScanPending(device) ? 'scan-pending' : 'clean';
}

/**
 * True while the last completed vulnerability-matching run does NOT cover this
 * device's current software inventory — matching never completed, or the
 * software changed after the run. Independent of whether the list is empty:
 * with results on screen it means a recent change (e.g. a patched CVE) may not
 * be reflected yet, which is what the "Data sync in progress" banner conveys.
 * False while there is nothing to match against (fleet failed / disconnected /
 * agent deploying / inventory never scanned) — those are earlier pipeline
 * stages with their own states, not a sync window.
 */
export function isVulnerabilityScanPending(device: Device): boolean {
  const fleetSource = device.sources?.fleet;
  if (fleetSource === 'error' || fleetSource === 'skipped-disconnected' || fleetSource === 'skipped-pending') {
    return false;
  }

  const softwareAt = fleetTimestampMs(device.software_updated_at);
  if (softwareAt === null) return false;

  const fleet = device.toolConnections?.find(tc => tc.toolType === 'FLEET_MDM');
  const matchedAt = fleetTimestampMs(fleet?.vulnerabilitiesUpdatedAt);
  return matchedAt === null || softwareAt > matchedAt;
}
