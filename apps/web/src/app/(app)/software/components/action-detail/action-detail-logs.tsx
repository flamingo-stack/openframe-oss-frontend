'use client';

import { SOFTWARE_ACTION_COPY } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { actionDetailLogs_action$key } from '@/__generated__/actionDetailLogs_action.graphql';
import type { ExecutionsTabState } from '@/app/(app)/scripts/shared/components/executions-table';
import { NO_ITEMS, NO_NEXT_PAGE } from '@/app/components/shared';
import { PackageManagerType, SoftwareAction } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { SoftwareLogsRows, SoftwareLogsTable } from './software-logs-table';

const actionDetailLogsFragment = graphql`
  fragment actionDetailLogs_action on SoftwareActionRun {
    executionId
    software
    engine
    action
  }
`;

interface ActionDetailLogsProps {
  action: actionDetailLogs_action$key | null | undefined;
  state: ExecutionsTabState;
}

/**
 * The run's per-device logs. Renders nothing for an id that isn't a run, or a
 * run whose action or manager this build does not know: the logs query takes
 * both as enums, and the summary reports the miss once. Before the run answers (a loading scope) it draws the
 * table's own loading state: the real header over its loading rows.
 */
export function ActionDetailLogs({ action, state }: ActionDetailLogsProps) {
  const loading = useLoadingScope();
  const data = useFragment(actionDetailLogsFragment, action);
  if (loading) {
    return (
      <SoftwareLogsRows
        allRows={NO_ITEMS}
        statusFacets={null}
        infiniteScroll={NO_NEXT_PAGE}
        actionLabel=""
        state={state}
      />
    );
  }
  const softwareAction = knownValue(SoftwareAction, data?.action);
  const packageManager = knownValue(PackageManagerType, data?.engine);
  if (!data || !softwareAction || !packageManager) return null;

  return (
    <SoftwareLogsTable
      packageManager={packageManager}
      packageName={data.software}
      action={softwareAction}
      executionId={data.executionId}
      actionLabel={SOFTWARE_ACTION_COPY[softwareAction].verb}
      state={state}
    />
  );
}
