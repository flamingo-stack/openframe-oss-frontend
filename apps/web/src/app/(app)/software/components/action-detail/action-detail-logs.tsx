'use client';

import { graphql, useFragment } from 'react-relay';
import type { actionDetailLogs_action$key } from '@/__generated__/actionDetailLogs_action.graphql';
import type { ExecutionsTabState } from '@/app/(app)/scripts/shared/components/executions-table';
import { PackageManagerType, SoftwareAction } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { SoftwareLogsTable } from './software-logs-table';

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
 * both as enums, and the summary reports the miss once.
 */
export function ActionDetailLogs({ action, state }: ActionDetailLogsProps) {
  const data = useFragment(actionDetailLogsFragment, action);
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
