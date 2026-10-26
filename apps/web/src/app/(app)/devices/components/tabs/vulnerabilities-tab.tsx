'use client';

import { BracketSquareCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SoftwareListFrame } from '@/app/(app)/software/components/shared/software-list-frame';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { Device } from '../../types/device.types';
import { getVulnerabilitiesEmptyReason, isVulnerabilityScanPending } from '../../utils/vulnerabilities-empty-state';
import { DataSyncBanner } from '../data-sync-banner';
import { DeviceVulnerabilitiesTable } from './device-vulnerabilities-table';
import { FleetVulnerabilitiesTab } from './fleet-vulnerabilities-tab';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface VulnerabilitiesTabProps {
  device: Device | null;
}

const SEARCH_PLACEHOLDER = 'Search for Vulnerability';

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
 * Fleet fan-out failure earns no Retry here: the list is its own request, and a
 * failed one trips the tab's boundary with a Retry of its own.
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
 * Device → Vulnerabilities over the Software module: the CVEs on this machine,
 * from the `deviceVulnerabilities` connection. The Vulnerabilities page is the
 * reference — the same frame, table and search, and like the page no sort — so
 * nothing here decides how a list of `Vulnerability` looks, and every row opens
 * the CVE's page in the module. What the tab adds is its own: the boundary that
 * keeps a failed list from taking the page down, the pipeline-stage copy for an
 * empty one and the sync banner.
 */
function ModuleVulnerabilitiesTab({ device, loading }: VulnerabilitiesTabProps & { loading: boolean }) {
  // The device (or the module's flag) has not answered: the frame and its rows draw their loading state.
  const scoped = useLoadingScope() || loading;
  // No agent id, no inventory to match against.
  if (!scoped && !device?.machineId) {
    return NO_VULNERABILITIES;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <SoftwareListFrame paramPrefix="cve" placeholder={SEARCH_PLACEHOLDER} loading={loading}>
        {list => (
          <ContentErrorBoundary label="VulnerabilitiesTab" message="Couldn't load this device's vulnerabilities.">
            <DeviceVulnerabilitiesTable
              debouncedSearch={list.debouncedSearch}
              isPending={list.isPending}
              onEmptyChange={list.onEmptyChange}
              stickyHeaderOffset={list.stickyHeaderOffset}
              machineId={device?.machineId ?? ''}
              emptyState={device ? vulnerabilitiesEmptyState(device) : NO_VULNERABILITIES}
            />
          </ContentErrorBoundary>
        )}
      </SoftwareListFrame>
      {/* The last matching run predates the current software inventory — e.g. a patched CVE may still show as
          active until the hourly run catches up. Below the list: drawn above it, its arrival would move the rows. */}
      {!scoped && device && isVulnerabilityScanPending(device) && <DataSyncBanner data-loading-optional />}
    </div>
  );
}

/**
 * Device → Vulnerabilities, switched on `software-management`. Off: the CVEs
 * in the Fleet host payload the device query already carries
 * (`FleetVulnerabilitiesTab`), each opening its NVD record. On: the module's
 * own table over `deviceVulnerabilities`, so the tab reads like the module's
 * page and its rows lead to the CVE's page there. Until the flag answers, the
 * module's frame in its loading state — see `SoftwareTab`.
 */
export function VulnerabilitiesTab({ device }: VulnerabilitiesTabProps) {
  const gate = useFeatureFlagGate('software-management');
  if (gate === 'off') return <FleetVulnerabilitiesTab device={device} />;
  return <ModuleVulnerabilitiesTab device={device} loading={gate === 'loading'} />;
}
