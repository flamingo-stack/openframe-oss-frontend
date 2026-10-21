'use client';

import { LoadingItems, LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { dataLossCoreRows_query$key } from '@/__generated__/dataLossCoreRows_query.graphql';
import { pluralNoun } from '@/lib/pluralize';
import { DataLossItem, DataLossStat } from './data-loss-item';
import { useCancellationImpact } from './use-cancellation-impact';

/**
 * Devices: all managed ones — `activeDevices` is only those online right now.
 * Articles and folders: the whole tree; the default scope is one level.
 * Scripts and schedules: ACTIVE only, archived ones won't run again anyway.
 */
const dataLossCoreRowsFragment = graphql`
  fragment dataLossCoreRows_query on Query {
    subscription {
      usage {
        devicesUsed
      }
    }
    organizations(first: 1) {
      filteredCount
    }
    articles: knowledgeBaseItems(filter: { type: ARTICLE, scope: DESCENDANTS }, first: 1) {
      filteredCount
    }
    folders: knowledgeBaseItems(filter: { type: FOLDER, scope: DESCENDANTS }, first: 1) {
      filteredCount
    }
    scripts(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
    scriptSchedules(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
    employeeTimeStats {
      periodTotalSeconds
    }
  }
`;

/**
 * One bar per core row the box can state (devices, customers, tickets, articles, scripts, policies and queries,
 * tracked hours): a fixed set, each with its own typical sentence width.
 */
const CORE_ROW_SKELETON_WIDTHS = ['w-1/2', 'w-1/3', 'w-3/4', 'w-2/3', 'w-2/5', 'w-3/4', 'w-1/2'] as const;

function DataLossCoreRowsSkeleton() {
  return (
    <LoadingWhen loading>
      <LoadingItems count={CORE_ROW_SKELETON_WIDTHS.length}>
        {index => <DataLossItem skeletonWidth={CORE_ROW_SKELETON_WIDTHS[index]} />}
      </LoadingItems>
    </LoadingWhen>
  );
}

/**
 * A zero figure drops its row, or its half of a row. "Events across monitoring
 * policies" from the design is left out: nothing in the schema or Fleet counts them.
 */
export function DataLossCoreRows({ query }: { query: dataLossCoreRows_query$key | null }) {
  const data = useFragment(dataLossCoreRowsFragment, query);
  // Tickets (ai-agent) and policies/queries (Fleet): the rows wait for them too.
  const external = useCancellationImpact();

  // `query` is null only while the dialog's query is on its way (drawn in a loading scope).
  if (useLoadingScope() || data == null || external == null) return <DataLossCoreRowsSkeleton />;

  const devices = data.subscription?.usage?.devicesUsed ?? 0;
  const customers = data.organizations.filteredCount;
  const articles = data.articles.filteredCount;
  const folders = data.folders.filteredCount;
  const scripts = data.scripts.filteredCount;
  const activeSchedules = data.scriptSchedules.filteredCount;
  const trackedHours = Math.floor(data.employeeTimeStats.periodTotalSeconds / 3600);
  const { tickets, monitoringPolicies, savedQueries } = external;

  return (
    <>
      {devices > 0 && (
        <DataLossItem>
          <DataLossStat value={devices} />
          {` managed ${pluralNoun(devices, 'device')}`}
        </DataLossItem>
      )}
      {customers > 0 && (
        <DataLossItem>
          <DataLossStat value={customers} />
          {` ${pluralNoun(customers, 'customer')}`}
        </DataLossItem>
      )}
      {tickets > 0 && (
        <DataLossItem>
          <DataLossStat value={tickets} />
          {` ${pluralNoun(tickets, 'ticket')} and all client communication`}
        </DataLossItem>
      )}
      {articles > 0 && (
        <DataLossItem>
          <DataLossStat value={articles} />
          {` knowledge base ${pluralNoun(articles, 'article')}`}
          {folders > 0 && (
            <>
              {` across `}
              <DataLossStat value={folders} />
              {` ${pluralNoun(folders, 'folder')}`}
            </>
          )}
        </DataLossItem>
      )}
      {scripts > 0 && (
        <DataLossItem>
          <DataLossStat value={scripts} />
          {` ${pluralNoun(scripts, 'script')}`}
          {activeSchedules > 0 && (
            <>
              {` with `}
              <DataLossStat value={activeSchedules} />
              {` active ${pluralNoun(activeSchedules, 'schedule')}`}
            </>
          )}
        </DataLossItem>
      )}
      {(monitoringPolicies > 0 || savedQueries > 0) && (
        <DataLossItem>
          {monitoringPolicies > 0 && (
            <>
              <DataLossStat value={monitoringPolicies} />
              {` monitoring ${pluralNoun(monitoringPolicies, 'policy', 'policies')}`}
            </>
          )}
          {monitoringPolicies > 0 && savedQueries > 0 && ` and `}
          {savedQueries > 0 && (
            <>
              <DataLossStat value={savedQueries} />
              {` saved ${pluralNoun(savedQueries, 'query', 'queries')}`}
            </>
          )}
        </DataLossItem>
      )}
      {trackedHours > 0 && (
        <DataLossItem>
          <DataLossStat value={trackedHours} />
          {` ${pluralNoun(trackedHours, 'hour')} of tracked work time`}
        </DataLossItem>
      )}
    </>
  );
}
