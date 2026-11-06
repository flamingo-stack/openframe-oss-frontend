'use client';

import { NotFoundError, Tag } from '@flamingo-stack/openframe-frontend-core';
import { packageManagerLabel, softwareActionCopy } from '@flamingo-stack/openframe-frontend-core/components/features';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { actionDetailSummary_action$key } from '@/__generated__/actionDetailSummary_action.graphql';
import { PackageManagerType } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { formatCount } from '@/lib/format-number';
import { ProcessedDevicesCount } from '../shared/processed-devices-count';
import { SummaryCard } from '../shared/summary-card';
import { ActionDetailLogsHeading } from './action-detail-logs-heading';
import { ACTION_DETAIL_SUMMARY_LABELS as LABELS } from './action-detail-summary-labels';
import { ActionPackageVersion } from './action-package-version';

const actionDetailSummaryFragment = graphql`
  fragment actionDetailSummary_action on SoftwareActionRun {
    software
    engine
    action
    version
    respondedMachineCount
    totalMachineCount
    waitingMachineCount
  }
`;

/**
 * The run's package, manager, catalog version and progress — and the page's
 * single not-found report, so a bad id is stated once.
 */
export function ActionDetailSummary({ action }: { action: actionDetailSummary_action$key | null | undefined }) {
  const loading = useLoadingScope();
  const fragment = useFragment(actionDetailSummaryFragment, action);
  const data = loading ? null : fragment;

  if (!loading && !data) {
    return <NotFoundError message="Software action not found" />;
  }

  const packageManager = data ? knownValue(PackageManagerType, data.engine) : null;

  // With no record yet (a loading scope) the same card and heading, the labels real and every value its own bar.
  return (
    <LoadingWhen loading={data == null}>
      <SummaryCard
        columns={4}
        fields={[
          { label: LABELS.software, value: data?.software },
          { label: LABELS.packageManager, value: data ? packageManagerLabel(data.engine) : null },
          {
            label: LABELS.packageVersion,
            // The version the run went to; a run without one went to the latest, which the catalog knows. No catalog
            // to ask for a manager this build does not know.
            value: data?.version ? (
              data.version
            ) : data && packageManager ? (
              <ActionPackageVersion packageManager={packageManager} packageName={data.software} />
            ) : null,
          },
          {
            label: LABELS.processed,
            value: data ? (
              <span className="flex flex-wrap items-center gap-[var(--spacing-system-xsf)]">
                <span>
                  <ProcessedDevicesCount responded={data.respondedMachineCount} total={data.totalMachineCount} />
                </span>
                {/* Devices whose update is on hold there: the app is still open. */}
                {data.waitingMachineCount > 0 && (
                  <Tag label={`${formatCount(data.waitingMachineCount)} Waiting`} variant="warning" />
                )}
              </span>
            ) : null,
          },
        ]}
      />
      <ActionDetailLogsHeading text={data ? (softwareActionCopy(data.action)?.logsHeading ?? 'Logs') : null} />
    </LoadingWhen>
  );
}
