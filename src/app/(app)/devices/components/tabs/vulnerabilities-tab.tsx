'use client';

import { BracketSquareCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SoftwareListFrame } from '@/app/(app)/software/components/shared/software-list-frame';
import { VULNERABILITY_LIST_TABLE_COLUMNS } from '@/app/(app)/software/components/vulnerability-list/vulnerability-list-columns';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import type { Device } from '../../types/device.types';
import { getVulnerabilitiesEmptyReason, isVulnerabilityScanPending } from '../../utils/vulnerabilities-empty-state';
import { DataSyncBanner } from '../data-sync-banner';
import { DEVICE_TAB_SKELETON_ROWS } from './device-tab-columns';
import { DeviceVulnerabilitiesTable } from './device-vulnerabilities-table';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface VulnerabilitiesTabProps {
  device: Device | null;
}

const NO_VULNERABILITIES = (
  <TabEmptyState
    icon={<BracketSquareCheckIcon />}
    title="No vulnerabilities found"
    description="Detected vulnerabilities for this device will appear here."
  />
);

/**
 * An empty list is only "no vulnerabilities" once the pipeline actually ran —
 * otherwise say which stage it is at (`vulnerabilities-empty-state.ts`). A
 * Fleet fan-out failure no longer earns a Retry here: the list is its own
 * request now, and a failed one trips the tab's boundary with a Retry of its own.
 */
function vulnerabilitiesEmptyState(device: Device) {
  const reason = getVulnerabilitiesEmptyReason(device);

  if (reason === 'disconnected') {
    return (
      <TabEmptyState
        icon={<BracketSquareCheckIcon />}
        title="Fleet is not connected"
        description="The Fleet agent for this device is disconnected, so vulnerability data is unavailable."
      />
    );
  }

  if (reason === 'collecting') {
    // Agent still deploying → the design's connecting-state copy; agent live
    // but the first inventory scan hasn't finished → collecting copy.
    if (device.sources?.fleet === 'skipped-pending') {
      return <TabDeployingEmptyState icon={<BracketSquareCheckIcon />} section="Vulnerabilities" />;
    }
    return (
      <TabEmptyState
        icon={<BracketSquareCheckIcon />}
        title="Collecting software inventory"
        description="This device hasn't reported its installed software yet. Vulnerabilities will appear once the inventory arrives."
      />
    );
  }

  if (reason === 'scan-pending') {
    return (
      <TabEmptyState
        icon={<BracketSquareCheckIcon />}
        title="Vulnerability scan pending"
        description="The latest software inventory hasn't been checked for vulnerabilities yet. Check back shortly."
      />
    );
  }

  return NO_VULNERABILITIES;
}

/**
 * Device → Vulnerabilities: the CVEs on this machine, from the
 * `deviceVulnerabilities` connection. The Vulnerabilities page is the
 * reference — the same frame, table and search, and like the page no sort —
 * so nothing here decides how a list of `Vulnerability` looks. What the tab
 * adds is its own: the boundary that keeps a failed list from taking the page
 * down, the pipeline-stage copy for an empty one, the sync banner and the link
 * gate for a tenant without the Software module.
 */
export function VulnerabilitiesTab({ device }: VulnerabilitiesTabProps) {
  // Rows link into the CVE's page in the Software module; without the module
  // the trailing button opens NVD instead and the rows stay plain.
  const linksEnabled = useFeatureFlag('software-management');

  // No agent id, no inventory to match against.
  if (!device?.machineId) {
    return NO_VULNERABILITIES;
  }

  return (
    <SoftwareListFrame
      paramPrefix="cve"
      placeholder="Search for Vulnerability"
      skeletonColumns={VULNERABILITY_LIST_TABLE_COLUMNS}
      skeletonRows={DEVICE_TAB_SKELETON_ROWS}
      // Results are on screen but the last matching run predates the current
      // software inventory — e.g. a patched CVE may still show as active until
      // the hourly run catches up.
      banner={isVulnerabilityScanPending(device) && <DataSyncBanner className="mb-[var(--spacing-system-l)]" />}
    >
      {list => (
        <ContentErrorBoundary label="VulnerabilitiesTab" message="Couldn't load this device's vulnerabilities.">
          <DeviceVulnerabilitiesTable
            debouncedSearch={list.debouncedSearch}
            isPending={list.isPending}
            onEmptyChange={list.onEmptyChange}
            stickyHeaderOffset={list.stickyHeaderOffset}
            machineId={device.machineId}
            linksEnabled={linksEnabled}
            emptyState={vulnerabilitiesEmptyState(device)}
          />
        </ContentErrorBoundary>
      )}
    </SoftwareListFrame>
  );
}
