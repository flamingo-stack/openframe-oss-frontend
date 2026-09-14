'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ReactNode, Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { packageVersionRelayQuery as PackageVersionQueryType } from '@/__generated__/packageVersionRelayQuery.graphql';
import type { softwareExecutionsRelay_query$key as ExecutionsFragmentKey } from '@/__generated__/softwareExecutionsRelay_query.graphql';
import type { softwareExecutionsRelayPaginationQuery as ExecutionsPaginationQueryType } from '@/__generated__/softwareExecutionsRelayPaginationQuery.graphql';
import type { softwareExecutionsRelayQuery as ExecutionsQueryType } from '@/__generated__/softwareExecutionsRelayQuery.graphql';
import type { softwareExecutionSummaryRelayQuery as SummaryQueryType } from '@/__generated__/softwareExecutionSummaryRelayQuery.graphql';
import {
  EXECUTIONS_PAGE_SIZE,
  ExecutionsTable,
  ExecutionsTabShell,
  type ExecutionsTabState,
  narrowExecutions,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from '@/app/(app)/scripts/shared/components/executions-table';
import { InlineSkeleton, useRetryKey } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import {
  type BrewPackageType,
  type PackageManagerType,
  ScriptExecutionStatus,
  SoftwareAction,
} from '@/generated/schema-enums';
import { packageVersionRelayQuery } from '@/graphql/software/package-version-relay';
import { softwareExecutionSummaryRelayQuery } from '@/graphql/software/software-execution-summary-relay';
import {
  softwareExecutionsRelayFragment,
  softwareExecutionsRelayQuery,
} from '@/graphql/software/software-executions-relay';
import { routes } from '@/lib/routes';
import { PACKAGE_MANAGER_LABEL } from './package-managers';

const CARD = 'grid grid-cols-1 rounded-md border border-ods-border bg-ods-card md:grid-cols-4';
const CELL = 'flex min-h-14 items-center p-[var(--spacing-system-m)] md:min-h-20';

/** One catalog package's runs of one action — what the page is about. */
export interface SoftwarePackageRuns {
  packageManager: PackageManagerType;
  packageName: string;
  action: SoftwareAction;
  brewPackageType: BrewPackageType | null;
}

const EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'Runs of this package will be displayed here',
};

// ----------------------------------------------------------------
// Summary card — each server-backed cell is its own island
// ----------------------------------------------------------------

/** A summary value that loads on its own; a failure reads as "—" instead of taking the page down. */
function Island({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={<>—</>}>
      <Suspense fallback={<InlineSkeleton className="h-6 w-20" />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function PackageVersion({ runs }: { runs: SoftwarePackageRuns }) {
  const data = useLazyLoadQuery<PackageVersionQueryType>(
    packageVersionRelayQuery,
    { packageManager: runs.packageManager, packageId: runs.packageName, packageType: runs.brewPackageType },
    { fetchPolicy: 'store-or-network' },
  );
  return <>{data.packageDetails.versions[0]?.version ?? '—'}</>;
}

const FINISHED: readonly string[] = [ScriptExecutionStatus.SUCCESS, ScriptExecutionStatus.FAILED];

/**
 * Finished runs over all runs. One run is one device's execution, so on a
 * package run once per device this is the design's "processed devices".
 */
function ProcessedDevices({ runs }: { runs: SoftwarePackageRuns }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SummaryQueryType>(
    softwareExecutionSummaryRelayQuery,
    { packageManager: runs.packageManager, packageName: runs.packageName, action: runs.action },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { statuses, filteredCount } = data.softwareExecutionFilters;
  const finished = statuses.filter(s => FINISHED.includes(s.value)).reduce((sum, s) => sum + s.count, 0);
  return (
    <>
      {finished}
      <span className="text-ods-text-secondary">/{filteredCount}</span>
    </>
  );
}

function SummaryCard({ runs }: { runs: SoftwarePackageRuns }) {
  const cells = [
    <InfoCell key="name" value={runs.packageName} label="Software Name" />,
    <InfoCell key="manager" value={PACKAGE_MANAGER_LABEL[runs.packageManager]} label="Package Manager" />,
    <InfoCell
      key="version"
      value={
        <Island>
          <PackageVersion runs={runs} />
        </Island>
      }
      label="Package Version"
    />,
    <InfoCell
      key="processed"
      value={
        <Island>
          <ProcessedDevices runs={runs} />
        </Island>
      }
      label="Processed Devices"
    />,
  ];

  return (
    <div className={CARD}>
      {cells.map((cell, idx) => (
        <div
          key={cell.key}
          className={`${CELL} ${idx < cells.length - 1 ? 'border-b border-ods-border md:border-b-0' : ''}`}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Logs — the shared executions table, fed by softwareExecutions
// ----------------------------------------------------------------

function SoftwareExecutionsContent({ runs, state }: { runs: SoftwarePackageRuns; state: ExecutionsTabState }) {
  const { backendFilters, sort, querySearch, narrowSearch, ...tableState } = state;

  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<ExecutionsQueryType>(
    softwareExecutionsRelayQuery,
    {
      packageManager: runs.packageManager,
      packageName: runs.packageName,
      action: runs.action,
      filter: backendFilters,
      search: querySearch || null,
      sort,
      first: EXECUTIONS_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const facetOptions = useExecutionFacetOptions(queryData.softwareExecutionFilters);

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ExecutionsPaginationQueryType,
    ExecutionsFragmentKey
  >(softwareExecutionsRelayFragment, queryData);

  const executions: UiExecution[] = useMemo(() => {
    const edges = data.softwareExecutions?.edges ?? [];
    const rows = edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node)] : []));
    return narrowExecutions(rows, narrowSearch);
  }, [data.softwareExecutions?.edges, narrowSearch]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      search={querySearch}
      emptyState={EMPTY_STATE}
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={fetchNextPage}
      {...tableState}
    />
  );
}

/**
 * Software Update Details (design 409:47428) — and its install twin: the
 * package, how far its runs got, and the per-device logs.
 *
 * The header and the static cells come from the URL, so they paint at once;
 * only the two server-backed cells and the logs wait.
 */
export function SoftwareExecutionsView({ runs }: { runs: SoftwarePackageRuns }) {
  const isUpdate = runs.action === SoftwareAction.UPDATE;
  const handleBack = useSafeBack(isUpdate ? routes.software.updates : routes.software.list);

  return (
    <PageLayout
      title={isUpdate ? 'Software Update Details' : 'Software Install Details'}
      backButton={{ label: 'Back', onClick: handleBack }}
    >
      <SummaryCard runs={runs} />
      <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">
        {isUpdate ? 'Update Logs' : 'Install Logs'}
      </h2>
      <ExecutionsTabShell>{state => <SoftwareExecutionsContent runs={runs} state={state} />}</ExecutionsTabShell>
    </PageLayout>
  );
}
