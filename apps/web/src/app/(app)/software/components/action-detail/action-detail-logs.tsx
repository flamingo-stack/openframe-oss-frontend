'use client';

import { SOFTWARE_ACTION_COPY } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { actionDetailLogs_action$key } from '@/__generated__/actionDetailLogs_action.graphql';
import type { ExecutionsTabState } from '@/app/(app)/scripts/shared/components/executions-table';
import { NO_ITEMS } from '@/app/components/shared';
import { SoftwareAction } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { SoftwareLogsRows, SoftwareLogsTable } from './software-logs-table';

const actionDetailLogsFragment = graphql`
  fragment actionDetailLogs_action on SoftwareActionRun {
    id
    action
  }
`;

interface ActionDetailLogsProps {
  action: actionDetailLogs_action$key | null | undefined;
  state: ExecutionsTabState;
}

/**
 * The run's per-device logs. Renders nothing for an id that isn't a run: the summary reports the miss once. Before
 * the run answers (a loading scope) it draws the table's own loading state: the real header over its loading rows.
 */
export function ActionDetailLogs({ action, state }: ActionDetailLogsProps) {
  const loading = useLoadingScope();
  const data = useFragment(actionDetailLogsFragment, action);
  if (loading) {
    return <SoftwareLogsRows allRows={NO_ITEMS} actionLabel="" state={state} />;
  }
  if (!data) return null;
  const softwareAction = knownValue(SoftwareAction, data.action);

  return (
    <SoftwareLogsTable
      actionId={data.id}
      actionLabel={softwareAction ? SOFTWARE_ACTION_COPY[softwareAction].verb : ''}
      state={state}
    />
  );
}
