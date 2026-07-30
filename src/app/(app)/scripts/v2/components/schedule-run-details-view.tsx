'use client';

import { NotFoundError, Tag } from '@flamingo-stack/openframe-frontend-core';
import { Skeleton, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleExecutionsRelay_query$key as ScheduleExecutionsFragmentKey } from '@/__generated__/scheduleExecutionsRelay_query.graphql';
import type { scheduleExecutionsRelayPaginationQuery as ScheduleExecutionsPaginationQueryType } from '@/__generated__/scheduleExecutionsRelayPaginationQuery.graphql';
import type { scheduleExecutionsRelayQuery as ScheduleExecutionsQueryType } from '@/__generated__/scheduleExecutionsRelayQuery.graphql';
import type { scheduleRunDetailRelayQuery as ScheduleRunDetailQueryType } from '@/__generated__/scheduleRunDetailRelayQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import {
  scheduleExecutionsRelayFragment,
  scheduleExecutionsRelayQuery,
} from '@/graphql/scripts/schedule-executions-relay';
import { scheduleRunDetailRelayQuery } from '@/graphql/scripts/schedule-run-detail-relay';
import { getFullImageUrl } from '@/lib/image-url';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import {
  executionStatusLabel,
  executionStatusVariant,
  formatExecutionTimestamp,
  initiatorInitials,
  initiatorName,
} from '../utils/execution-helpers';
import {
  EXECUTIONS_PAGE_SIZE,
  ExecutionsTable,
  ExecutionsTabShell,
  type ExecutionsTabState,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from './executions-table';
import { ScriptPageChrome } from './script-page-chrome';

interface ScheduleRunDetailsViewProps {
  /** `ScheduleRun` global id — see `routes.scriptsV2.schedules.run`. */
  runId: string;
}

const PAGE_TITLE = 'Script Schedule Execution Details';

// ----------------------------------------------------------------
// Info bar
// ----------------------------------------------------------------

/** A value-over-label cell, matching the schedule's own info bar (80px on md+). */
function RunInfoCell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px] ${className ?? ''}`}
    >
      {children}
      <span className="text-h6 text-ods-text-secondary">{label}</span>
    </div>
  );
}

type RunNode = NonNullable<ScheduleRunDetailQueryType['response']['node']>;

function RunInfoBar({ run }: { run: RunNode }) {
  const initiator = 'initiator' in run ? run.initiator : null;
  const status = 'status' in run ? run.status : null;
  const dispatchedAt = 'dispatchedAt' in run ? run.dispatchedAt : null;
  const finishedAt = 'finishedAt' in run ? run.finishedAt : null;
  const responded = 'respondedMachineCount' in run ? run.respondedMachineCount : 0;
  const total = 'totalMachineCount' in run ? run.totalMachineCount : 0;

  // The initiator id is a User global id; the REST-backed employee page wants the
  // raw one (same decode the execution-details page does).
  const rawInitiatorId = initiator?.id ? (decodeGlobalId(initiator.id)?.rawId ?? initiator.id) : '';
  const initiatorHref = rawInitiatorId ? employeeDetailHref(rawInitiatorId) : null;

  return (
    <div className="flex flex-col gap-0 bg-ods-card border border-ods-border rounded-[6px] overflow-clip w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-ods-border">
        {/* Design 310:33508 labels this cell "Script Name". A ScheduleRun has no
            script reference — a fire dispatches whatever scripts the schedule
            held — so the honest equivalent is how many devices answered it. */}
        <RunInfoCell label="Devices Responded" className="border-b md:border-b-0 border-ods-border">
          <span className="text-h4 text-ods-text-primary truncate">
            {responded} / {total}
          </span>
        </RunInfoCell>
        <RunInfoCell label="Executed by" className="border-b md:border-b-0 border-ods-border">
          <div className="flex items-center gap-2 min-w-0">
            <SquareAvatar
              variant="round"
              size="sm"
              src={getFullImageUrl(initiator?.image?.imageUrl, initiator?.image?.hash)}
              fallback={initiatorInitials(initiator)}
              alt={initiatorName(initiator)}
              initialsClassName="text-ods-text-secondary"
            />
            {initiatorHref ? (
              <a
                href={initiatorHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-h4 text-ods-accent hover:text-ods-accent-hover underline truncate"
              >
                {initiatorName(initiator)}
              </a>
            ) : (
              <span className="text-h4 text-ods-text-primary truncate">{initiatorName(initiator)}</span>
            )}
          </div>
        </RunInfoCell>
        <RunInfoCell label="Status">
          <Tag label={executionStatusLabel(status)} variant={executionStatusVariant(status)} />
        </RunInfoCell>
        {/* The design's fourth slot is an empty spacer, not a cell. */}
        <div className="hidden md:block" />
      </div>
      <div className="grid grid-cols-2">
        <RunInfoCell label="Start Time">
          <span className="text-h4 text-ods-text-primary truncate">{formatExecutionTimestamp(dispatchedAt)}</span>
        </RunInfoCell>
        <RunInfoCell label="Finish Time">
          <span className="text-h4 text-ods-text-primary truncate">{formatExecutionTimestamp(finishedAt)}</span>
        </RunInfoCell>
      </div>
    </div>
  );
}

/** Mirrors `RunInfoBar`'s two rows so the header keeps its height while loading. */
function RunInfoBarSkeleton() {
  return (
    <div className="flex flex-col gap-0 bg-ods-card border border-ods-border rounded-[6px] overflow-clip w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-ods-border">
        {['responded', 'by', 'status', 'spacer'].map(cell => (
          <div key={cell} className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
            <div className="text-h4">
              <Skeleton className="inline-block h-3 md:h-4 w-20 max-w-full" />
            </div>
            <div className="text-h6">
              <Skeleton className="inline-block h-2.5 md:h-3 w-14 max-w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2">
        {['start', 'finish'].map(cell => (
          <div key={cell} className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
            <div className="text-h4">
              <Skeleton className="inline-block h-3 md:h-4 w-32 max-w-full" />
            </div>
            <div className="text-h6">
              <Skeleton className="inline-block h-2.5 md:h-3 w-16 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Executions of this run
// ----------------------------------------------------------------

function RunExecutionsContent({ scheduleId, state }: { scheduleId: string; state: ExecutionsTabState }) {
  const { backendFilters, debouncedSearch, ...tableState } = state;

  const queryData = useLazyLoadQuery<ScheduleExecutionsQueryType>(
    scheduleExecutionsRelayQuery,
    { scheduleId, filter: backendFilters, search: debouncedSearch || null, first: EXECUTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const facetOptions = useExecutionFacetOptions(queryData.scheduleExecutionFilters);

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ScheduleExecutionsPaginationQueryType,
    ScheduleExecutionsFragmentKey
  >(scheduleExecutionsRelayFragment, queryData);

  const executions: UiExecution[] = useMemo(() => {
    const edges = data.scheduleExecutions?.edges ?? [];
    return edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node)] : []));
  }, [data.scheduleExecutions?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      // Empty string, not the scope: `search` only picks the empty-state copy, and
      // the executionId is the page's identity rather than something the user typed.
      search=""
      emptyHint="This run produced no executions."
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={fetchNextPage}
      {...tableState}
    />
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

function ScheduleRunDetailsContent({ runId }: ScheduleRunDetailsViewProps) {
  const data = useLazyLoadQuery<ScheduleRunDetailQueryType>(
    scheduleRunDetailRelayQuery,
    { id: runId },
    { fetchPolicy: 'store-and-network' },
  );
  const run = data.node;

  // `node(id)` resolves anything; a wrong id yields a record without the run's
  // fields rather than null, so the narrowed selection is what proves the type.
  const executionId = run && 'executionId' in run ? run.executionId : undefined;
  if (!run || !executionId) {
    return <NotFoundError message="Schedule run not found" />;
  }

  const scheduleId = ('scheduleId' in run ? run.scheduleId : '') ?? '';

  return (
    <ScriptPageChrome
      title={PAGE_TITLE}
      subtitle={executionId}
      backFallback={
        scheduleId ? routes.scriptsV2.schedules.details(scheduleId, { tab: 'runs' }) : routes.scriptsV2.schedules.list
      }
      actions={[]}
    >
      <div className="flex flex-col gap-[var(--spacing-system-lf)]">
        <RunInfoBar run={run} />
        {/* `scopeSearch` pins the list to this fire: every execution of a run
            carries the run's executionId, and search is the only argument that
            narrows on it.

            `scheduleExecutions` is keyed by schedule, so without one there is
            nothing to scope — firing the query with an empty `ID!` would throw
            inside the Suspense boundary and take the run summary above down
            with it, rather than leaving the page readable. */}
        {scheduleId ? (
          <ExecutionsTabShell scopeSearch={executionId}>
            {state => <RunExecutionsContent scheduleId={scheduleId} state={state} />}
          </ExecutionsTabShell>
        ) : (
          <p className="text-h6 text-ods-text-secondary">
            This run is not linked to a schedule, so its executions can't be listed.
          </p>
        )}
      </div>
    </ScriptPageChrome>
  );
}

/**
 * One fire of a schedule (Figma 310:33508): the run's own summary over the
 * executions it produced. Reached from the Schedule Runs tab; before this page
 * existed that arrow opened the schedule's Execution History with the run's
 * executionId typed into its search box, which showed the same rows but under
 * the schedule's identity and with no way to link to the run itself.
 *
 * Like the execution-details page, the chrome here IS data-dependent (subtitle
 * and Back target come from the run), so the loaded view and the Suspense
 * fallback each render their own {@link ScriptPageChrome}.
 */
export function ScheduleRunDetailsView({ runId }: ScheduleRunDetailsViewProps) {
  return (
    <Suspense
      fallback={
        <ScriptPageChrome
          title={PAGE_TITLE}
          // The executionId always arrives — hold its line so the header does
          // not grow under the content when it does.
          subtitleRow="always"
          backFallback={routes.scriptsV2.schedules.list}
          actions={[]}
        >
          <RunInfoBarSkeleton />
        </ScriptPageChrome>
      }
    >
      <ScheduleRunDetailsContent runId={runId} />
    </Suspense>
  );
}
