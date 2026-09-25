'use client';

import { WebDesignIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SoftwareListFrame } from '@/app/(app)/software/components/shared/software-list-frame';
import {
  SOFTWARE_LIST_FILTER_COLUMN_IDS,
  SOFTWARE_LIST_SORTABLE_COLUMN_IDS,
  SOFTWARE_LIST_TABLE_COLUMNS,
} from '@/app/(app)/software/components/software-list/software-list-columns';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import type { Device } from '../../types/device.types';
import { getVulnerabilitiesEmptyReason } from '../../utils/vulnerabilities-empty-state';
import { DeviceSoftwareTable } from './device-software-table';
import { DEVICE_TAB_SKELETON_ROWS } from './device-tab-columns';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface SoftwareTabProps {
  device: Device | null;
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
 * fan-out failure no longer earns a Retry here: the list is its own request
 * now, and a failed one trips the tab's boundary with a Retry of its own.
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
 * Device → Software: the titles installed on this machine, from the
 * `deviceSoftware` connection. The Software page is the reference — the same
 * frame, table, search, sort toggles and funnels over this device's rows — so nothing
 * here decides how a list of `Software` looks. What the tab adds is its own:
 * the boundary that keeps a failed list from taking the page down, the
 * pipeline-stage copy for an empty one, and the link gate for a tenant without
 * the Software module.
 */
export function SoftwareTab({ device }: SoftwareTabProps) {
  // Rows link into the Software module's pages; without the module there is
  // nothing to open, so they stay plain rows.
  const linksEnabled = useFeatureFlag('software-management');

  // No agent id, no inventory to ask for.
  if (!device?.machineId) {
    return NO_SOFTWARE;
  }

  return (
    <SoftwareListFrame
      paramPrefix="software"
      placeholder="Search for Software"
      sortableIds={SOFTWARE_LIST_SORTABLE_COLUMN_IDS}
      filterKeys={SOFTWARE_LIST_FILTER_COLUMN_IDS}
      skeletonColumns={SOFTWARE_LIST_TABLE_COLUMNS}
      skeletonRows={DEVICE_TAB_SKELETON_ROWS}
    >
      {list => (
        <ContentErrorBoundary label="SoftwareTab" message="Couldn't load this device's software.">
          <DeviceSoftwareTable
            {...list}
            machineId={device.machineId}
            linksEnabled={linksEnabled}
            emptyState={softwareEmptyState(device)}
          />
        </ContentErrorBoundary>
      )}
    </SoftwareListFrame>
  );
}
