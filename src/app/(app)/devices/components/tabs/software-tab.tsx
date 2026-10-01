'use client';

import { WebDesignIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SoftwareListFrame } from '@/app/(app)/software/components/shared/software-list-frame';
import { SOFTWARE_LIST_TABLE_COLUMNS } from '@/app/(app)/software/components/software-list/software-list-columns';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { Device } from '../../types/device.types';
import { getVulnerabilitiesEmptyReason } from '../../utils/vulnerabilities-empty-state';
import { DeviceSoftwareTable } from './device-software-table';
import { DEVICE_TAB_SKELETON_ROWS, FLEET_SOFTWARE_TAB_COLUMNS } from './device-tab-columns';
import { FleetSoftwareTab } from './fleet-software-tab';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';
import { TableTabSkeleton } from './table-tab-skeleton';

interface SoftwareTabProps {
  device: Device | null;
}

const SEARCH_PLACEHOLDER = 'Search for Software';

/**
 * The tab's loading state — drawn by the page skeleton while the device is in
 * flight, and by the tab itself until `software-management` answers. It reads
 * the gate so its columns are the ones the live tab will draw: the module's
 * once the flag is on, Fleet's otherwise. `'loading'` draws Fleet's the way
 * `useDeviceTabs` draws the base tab set until a flag says more: both layouts
 * are one search box over the same rows, so the answer can at most relabel the
 * header — it never adds or removes a control.
 */
export function SoftwareTabSkeleton() {
  const gate = useFeatureFlagGate('software-management');
  return (
    <TableTabSkeleton
      columns={gate === 'on' ? SOFTWARE_LIST_TABLE_COLUMNS : FLEET_SOFTWARE_TAB_COLUMNS}
      placeholder={SEARCH_PLACEHOLDER}
    />
  );
}

const NO_SOFTWARE = (
  <TabEmptyState
    icon={<WebDesignIcon />}
    title="No software found"
    description="Installed software for this device will appear here."
  />
);

/**
 * What an empty inventory means, by the stage the pipeline is at — the same
 * decision table the Vulnerabilities tab reads (`vulnerabilities-empty-state.ts`),
 * stopping before the matching stages that only a CVE list cares about. A Fleet
 * fan-out failure earns no Retry here: the list is its own request, and a
 * failed one trips the tab's boundary with a Retry of its own.
 */
function softwareEmptyState(device: Device) {
  const reason = getVulnerabilitiesEmptyReason(device);

  if (reason === 'disconnected') {
    return (
      <TabEmptyState
        icon={<WebDesignIcon />}
        title="Fleet is not connected"
        description="The Fleet agent for this device is disconnected, so its software inventory is unavailable."
      />
    );
  }

  if (reason === 'collecting') {
    // Agent still deploying → the design's connecting-state copy; agent live
    // but the first inventory scan hasn't finished → collecting copy.
    if (device.sources?.fleet === 'skipped-pending') {
      return <TabDeployingEmptyState icon={<WebDesignIcon />} section="Software" />;
    }
    return (
      <TabEmptyState
        icon={<WebDesignIcon />}
        title="Collecting software inventory"
        description="This device hasn't reported its installed software yet. It will appear here once the inventory arrives."
      />
    );
  }

  return NO_SOFTWARE;
}

/**
 * Device → Software over the Software module: the titles installed on this
 * machine, from the `deviceSoftware` connection. The Software page is the
 * reference — the same frame, table, search and funnels over this
 * device's rows — so nothing here decides how a list of `Software` looks, and
 * every row opens the title's page in the module. What the tab adds is its
 * own: the boundary that keeps a failed list from taking the page down, and
 * the pipeline-stage copy for an empty one.
 */
function ModuleSoftwareTab({ device }: SoftwareTabProps) {
  // No agent id, no inventory to ask for.
  if (!device?.machineId) {
    return NO_SOFTWARE;
  }

  return (
    <SoftwareListFrame
      paramPrefix="software"
      placeholder={SEARCH_PLACEHOLDER}
      skeletonColumns={SOFTWARE_LIST_TABLE_COLUMNS}
      skeletonRows={DEVICE_TAB_SKELETON_ROWS}
    >
      {list => (
        <ContentErrorBoundary label="SoftwareTab" message="Couldn't load this device's software.">
          <DeviceSoftwareTable {...list} machineId={device.machineId} emptyState={softwareEmptyState(device)} />
        </ContentErrorBoundary>
      )}
    </SoftwareListFrame>
  );
}

/**
 * Device → Software, switched on `software-management`. Off: the Fleet host
 * payload the device query already carries (`FleetSoftwareTab`) — no module,
 * nothing to open, a list complete in hand. On: the module's own table over
 * `deviceSoftware`, so the tab reads like the module's page and its rows lead
 * there. Until the flag answers, the skeleton — not the Fleet list, which would
 * guess the module absent and swap the table out under the user
 * (`use-feature-flag.ts`).
 */
export function SoftwareTab({ device }: SoftwareTabProps) {
  const gate = useFeatureFlagGate('software-management');
  if (gate === 'loading') return <SoftwareTabSkeleton />;
  if (gate === 'off') return <FleetSoftwareTab device={device} />;
  return <ModuleSoftwareTab device={device} />;
}
