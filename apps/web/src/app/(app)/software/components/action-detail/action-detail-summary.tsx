'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { graphql, useFragment } from 'react-relay';
import type { actionDetailSummary_action$key } from '@/__generated__/actionDetailSummary_action.graphql';
import { PackageManagerType } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { packageManagerLabel } from '../shared/package-managers';
import { ProcessedDevicesCount } from '../shared/processed-devices-count';
import { softwareActionCopy } from '../shared/software-action-copy';
import { SummaryCard } from '../shared/summary-card';
import { ActionDetailLogsHeading } from './action-detail-logs-heading';
import { ACTION_DETAIL_SUMMARY_LABELS as LABELS } from './action-detail-summary-labels';
import { ActionPackageVersion } from './action-package-version';
import { SummaryValueIsland } from './summary-value-island';

const actionDetailSummaryFragment = graphql`
  fragment actionDetailSummary_action on SoftwareActionRun {
    software
    engine
    action
    respondedMachineCount
    totalMachineCount
  }
`;

/**
 * The run's package, manager, catalog version and progress — and the page's
 * single not-found report, so a bad id is stated once.
 */
export function ActionDetailSummary({ action }: { action: actionDetailSummary_action$key | null | undefined }) {
  const data = useFragment(actionDetailSummaryFragment, action);

  if (!data) {
    return <NotFoundError message="Software action not found" />;
  }

  const { software, engine, respondedMachineCount, totalMachineCount } = data;
  const packageManager = knownValue(PackageManagerType, engine);

  return (
    <>
      <SummaryCard
        columns={4}
        fields={[
          { label: LABELS.software, value: software },
          { label: LABELS.packageManager, value: packageManagerLabel(engine) },
          {
            label: LABELS.packageVersion,
            // No catalog to ask for a manager this build does not know.
            value: packageManager ? (
              <SummaryValueIsland>
                <ActionPackageVersion packageManager={packageManager} packageName={software} />
              </SummaryValueIsland>
            ) : null,
          },
          {
            label: LABELS.processed,
            value: <ProcessedDevicesCount responded={respondedMachineCount} total={totalMachineCount} />,
          },
        ]}
      />
      <ActionDetailLogsHeading>{softwareActionCopy(data.action)?.logsHeading ?? 'Logs'}</ActionDetailLogsHeading>
    </>
  );
}
