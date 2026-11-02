'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentProps } from 'react';
import { graphql } from 'react-relay';
import type { softwareActionDetailViewQuery as SoftwareActionDetailViewQueryType } from '@/__generated__/softwareActionDetailViewQuery.graphql';
import { ExecutionsTabShell } from '@/app/(app)/scripts/shared/components/executions-table';
import { QueryIsland } from '@/app/components/shared';
import { ActionDetailHeader } from './action-detail-header';
import { ActionDetailLogs } from './action-detail-logs';
import { ActionDetailSummary } from './action-detail-summary';

/**
 * One install/update run. Null for an id with no dispatched run behind it,
 * which includes every still-scheduled row of the list: those ids are synthetic
 * until the schedule fires, and the list does not link them.
 */
const softwareActionDetailViewQuery = graphql`
  query softwareActionDetailViewQuery($id: ID!) {
    softwareAction(id: $id) {
      ...actionDetailHeader_action
      ...actionDetailSummary_action
      ...actionDetailLogs_action
    }
  }
`;

interface SoftwareActionDetailViewProps {
  /** Software Action id — see `routes.software.action`. */
  actionId: string;
  /** The module's flag has not answered yet: every island draws its fallback and nothing fetches. */
  loading?: boolean;
}

/**
 * Software Update Details (design 409:47432) — and its install twin: one run of
 * one package, how far it got, and each device's result.
 *
 * Not `PageLayout`: the title is the record's answer (update or install), and
 * a `PageLayout` waiting for it would hold back the search toolbar too, which
 * needs no data. So the header, the summary and the logs each read the run in
 * their own `QueryIsland` — one request between them — and the logs' search
 * toolbar between the last two is real from the first frame.
 */
export function SoftwareActionDetailView({ actionId, loading = false }: SoftwareActionDetailViewProps) {
  const variables = { id: actionId };

  return (
    // No page padding here: it lives on the page's wrapper around
    // `ContentErrorBoundary`, so a thrown query keeps the fallback indented.
    <div className="flex w-full flex-col">
      {/* The bar stands for the title: whether this is an update or an install is the record's answer. */}
      <ActionHeaderIsland variables={variables} loading={loading} />

      <div className="flex flex-1 flex-col">
        <ActionSummaryIsland variables={variables} loading={loading} />

        <ExecutionsTabShell clientSearch searchPlaceholder="Search for Logs">
          {state => <ActionLogsIsland variables={variables} loading={loading} state={state} />}
        </ExecutionsTabShell>
      </div>
    </div>
  );
}

interface ActionIslandProps {
  variables: SoftwareActionDetailViewQueryType['variables'];
  /** The module's flag has not answered yet: the island draws its loading form and nothing fetches. */
  loading: boolean;
}

/**
 * The header, with its own boundary: in its scope the reader draws its own loading form. The bar stands for the
 * title: whether this is an update or an install is the record's answer.
 */
function ActionHeaderIsland({ variables, loading }: ActionIslandProps) {
  return (
    <LoadingSuspense live label="Loading action" gated={loading}>
      <ActionHeaderReader variables={variables} />
    </LoadingSuspense>
  );
}

function ActionHeaderReader({ variables }: Pick<ActionIslandProps, 'variables'>) {
  // In a loading scope it draws the header with no run and runs no read.
  if (useLoadingScope()) return <ActionDetailHeader action={null} />;
  return (
    <QueryIsland<SoftwareActionDetailViewQueryType> query={softwareActionDetailViewQuery} variables={variables}>
      {({ softwareAction }) => <ActionDetailHeader action={softwareAction} />}
    </QueryIsland>
  );
}

/** The summary, with its own boundary: in its scope the reader draws its own loading form. */
function ActionSummaryIsland({ variables, loading }: ActionIslandProps) {
  return (
    <LoadingSuspense label="Loading action" gated={loading}>
      <ActionSummaryReader variables={variables} />
    </LoadingSuspense>
  );
}

function ActionSummaryReader({ variables }: Pick<ActionIslandProps, 'variables'>) {
  // In a loading scope it draws the summary with no run and runs no read.
  if (useLoadingScope()) return <ActionDetailSummary action={null} />;
  return (
    <QueryIsland<SoftwareActionDetailViewQueryType> query={softwareActionDetailViewQuery} variables={variables}>
      {({ softwareAction }) => <ActionDetailSummary action={softwareAction} />}
    </QueryIsland>
  );
}

type ActionLogsState = ComponentProps<typeof ActionDetailLogs>['state'];

/**
 * The logs, with their own boundary, so loading draws this table's columns rather than the shell's script-execution
 * loading state: in its scope the reader draws its own loading form.
 */
function ActionLogsIsland({ variables, loading, state }: ActionIslandProps & { state: ActionLogsState }) {
  return (
    <LoadingSuspense label="Loading the action log" gated={loading}>
      <ActionLogsReader variables={variables} state={state} />
    </LoadingSuspense>
  );
}

function ActionLogsReader({ variables, state }: Pick<ActionIslandProps, 'variables'> & { state: ActionLogsState }) {
  // In a loading scope it draws the table with no run and runs no read.
  if (useLoadingScope()) return <ActionDetailLogs action={null} state={state} />;
  return (
    <QueryIsland<SoftwareActionDetailViewQueryType>
      query={softwareActionDetailViewQuery}
      variables={variables}
      fetchPolicy="store-or-network"
    >
      {({ softwareAction }) => <ActionDetailLogs action={softwareAction} state={state} />}
    </QueryIsland>
  );
}
