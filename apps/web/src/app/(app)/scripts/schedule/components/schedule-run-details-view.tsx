'use client';

import { NotFoundError, Tag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleExecutionsRelay_query$key as ScheduleExecutionsFragmentKey } from '@/__generated__/scheduleExecutionsRelay_query.graphql';
import type { scheduleExecutionsRelayPaginationQuery as ScheduleExecutionsPaginationQueryType } from '@/__generated__/scheduleExecutionsRelayPaginationQuery.graphql';
import type { scheduleExecutionsRelayQuery as ScheduleExecutionsQueryType } from '@/__generated__/scheduleExecutionsRelayQuery.graphql';
import type { scheduleRunDetailRelayQuery as ScheduleRunDetailQueryType } from '@/__generated__/scheduleRunDetailRelayQuery.graphql';
import { NO_ITEMS } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import {
  scheduleExecutionsRelayFragment,
  scheduleExecutionsRelayQuery,
} from '@/graphql/scripts/schedule-executions-relay';
import { scheduleRunDetailRelayQuery } from '@/graphql/scripts/schedule-run-detail-relay';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import {
  EXECUTIONS_PAGE_SIZE,
  ExecutionsTable,
  ExecutionsTabShell,
  type ExecutionsTabState,
  narrowExecutions,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from '../../shared/components/executions-table';
import { InitiatorIdentity, toInitiator } from '../../shared/components/initiator-identity';
import { executionStatusLabel, executionStatusVariant } from '../../shared/utils/execution-helpers';
import { DIVIDED_CELL_CLASS, INFO_BAR_FRAME_CLASS, infoBarCell } from './schedule-info-bar';

interface ScheduleRunDetailsViewProps {
  /** `ScheduleRun` global id — see `routes.scripts.schedules.run`. */
  runId: string;
}

const PAGE_TITLE = 'Script Schedule Execution Details';

/** The schedule tab's placeholder (design 1:48878), named for one fire. */
const EXECUTIONS_EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'This run produced no executions',
};

// ----------------------------------------------------------------
// Info bar
// ----------------------------------------------------------------

type RunNode = NonNullable<ScheduleRunDetailQueryType['response']['node']>;

/** A cell of the run's bar: the schedule's own info bar cell (80px on md+), so the two bars match. */
const runCell = infoBarCell;

/**
 * The run's info bar. Without the run (or in a loading scope) it draws itself: the same cells and labels, every
 * value a bar on its `text-h4` line, the avatar its own skeleton and the status a tag-shaped bar.
 */
function RunInfoBar({ run }: { run?: RunNode }) {
  const loading = useLoadingScope() || !run;
  const initiator = toInitiator(run && 'initiator' in run ? run.initiator : null);
  const status = run && 'status' in run ? run.status : null;
  const dispatchedAt = run && 'dispatchedAt' in run ? run.dispatchedAt : null;
  const finishedAt = run && 'finishedAt' in run ? run.finishedAt : null;
  const responded = run && 'respondedMachineCount' in run ? run.respondedMachineCount : 0;
  const total = run && 'totalMachineCount' in run ? run.totalMachineCount : 0;
  const executedBy = <InitiatorIdentity initiator={initiator} size="sm" loading={loading} />;

  return (
    <div className={INFO_BAR_FRAME_CLASS}>
      <div className="grid grid-cols-2 border-b border-ods-border content-md:grid-cols-4">
        {/* Design 310:33508 labels this cell "Script Name". A ScheduleRun has no
            script reference — a fire dispatches whatever scripts the schedule
            held — so the honest equivalent is how many devices answered it. */}
        <InfoCell
          label="Devices Responded"
          value={`${responded} / ${total}`}
          loading={loading}
          skeletonWidth="w-20"
          className={runCell(DIVIDED_CELL_CLASS)}
        />
        <InfoCell label="Executed by" value={executedBy} loading={loading} className={runCell(DIVIDED_CELL_CLASS)} />
        <InfoCell
          label="Status"
          // No label while the run is read: the tag draws its own skeleton in the cell's loading scope.
          value={<Tag label={loading ? '' : executionStatusLabel(status)} variant={executionStatusVariant(status)} />}
          loading={loading}
          className={runCell()}
        />
        {/* The design's fourth slot is an empty spacer, not a cell. */}
        <div className="hidden content-md:block" />
      </div>
      <div className="grid grid-cols-2">
        <InfoCell label="Start Time" value={formatDateTime(dispatchedAt)} loading={loading} className={runCell()} />
        <InfoCell label="Finish Time" value={formatDateTime(finishedAt)} loading={loading} className={runCell()} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// The run itself
// ----------------------------------------------------------------

/**
 * The run behind `runId`, read by each island on this page.
 *
 * `node(id)` resolves anything, and a wrong id yields a record WITHOUT the run's
 * fields rather than null — so the narrowed selection is what proves the type,
 * and every field comes back through the `in` checks below.
 *
 * All three islands issue this same query with the same variables; Relay dedupes
 * identical in-flight requests, so the page still costs one round trip.
 */
function useScheduleRun(runId: string, fetchPolicy: 'store-and-network' | 'store-or-network') {
  const data = useLazyLoadQuery<ScheduleRunDetailQueryType>(
    scheduleRunDetailRelayQuery,
    { id: runId },
    { fetchPolicy },
  );
  const run = data.node;

  return {
    run,
    executionId: run && 'executionId' in run ? run.executionId : undefined,
    scheduleId: (run && 'scheduleId' in run ? run.scheduleId : '') ?? '',
  };
}

// ----------------------------------------------------------------
// Islands
// ----------------------------------------------------------------

/**
 * The header island. The title is a constant, but the subtitle (the run's
 * executionId) and the Back target (the schedule it belongs to) are the record's
 * own answer, so this is what waits for it. It carries its own boundary; in its
 * scope the reader draws the header with no run.
 */
function RunHeader({ runId }: ScheduleRunDetailsViewProps) {
  return (
    <LoadingSuspense live label="Loading the run">
      <RunHeaderReader runId={runId} />
    </LoadingSuspense>
  );
}

function RunHeaderReader({ runId }: ScheduleRunDetailsViewProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read.
  if (useLoadingScope()) return <RunHeaderView />;
  return <RunHeaderLive runId={runId} />;
}

function RunHeaderLive({ runId }: ScheduleRunDetailsViewProps) {
  const { executionId, scheduleId } = useScheduleRun(runId, 'store-and-network');
  return <RunHeaderView executionId={executionId ?? null} scheduleId={scheduleId} />;
}

/**
 * The header over the run. Without it (`executionId` undefined, a loading scope)
 * the subtitle reads as `''`, which `TitleBlock` draws as a bar in its scope; the
 * title is a constant and stays real.
 */
function RunHeaderView({ executionId, scheduleId = '' }: { executionId?: string | null; scheduleId?: string }) {
  // Back to the fires of the schedule this run belongs to; a bad id has no
  // schedule to return to, so it falls back to the list.
  const handleBack = useSafeBack(
    scheduleId ? routes.scripts.schedules.details(scheduleId, { tab: 'runs' }) : routes.scripts.schedules.list,
  );

  return (
    <TitleBlock
      title={PAGE_TITLE}
      subtitle={executionId === undefined ? '' : (executionId ?? undefined)}
      // A run always has an executionId, so the row never collapses once loaded —
      // and the fallback below holds the same line with a bar in it.
      subtitleRow="always"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={NO_ITEMS}
    />
  );
}

/**
 * The summary island — and the page's single not-found report. It carries its
 * own boundary; in its scope the reader draws the info bar with no run.
 */
function RunSummary({ runId }: ScheduleRunDetailsViewProps) {
  return (
    <LoadingSuspense label="Loading run details">
      <RunSummaryReader runId={runId} />
    </LoadingSuspense>
  );
}

function RunSummaryReader({ runId }: ScheduleRunDetailsViewProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read.
  if (useLoadingScope()) return <RunInfoBar />;
  return <RunSummaryLive runId={runId} />;
}

function RunSummaryLive({ runId }: ScheduleRunDetailsViewProps) {
  const { run, executionId } = useScheduleRun(runId, 'store-and-network');

  if (!run || !executionId) {
    return <NotFoundError message="Schedule run not found" />;
  }

  return <RunInfoBar run={run} />;
}

// ----------------------------------------------------------------
// Executions of this run
// ----------------------------------------------------------------

/**
 * Waits for the run inside the shell's OWN boundary, so the search toolbar above
 * is the real one from the first frame rather than a placeholder shaped like it.
 *
 * Renders nothing for an id that isn't a run: the summary above reports the miss
 * once, and `scheduleExecutions` is keyed by schedule — firing it with an empty
 * `ID!` would throw here instead.
 */
function RunExecutions({ runId, state }: { runId: string; state: ExecutionsTabState }) {
  const { executionId, scheduleId } = useScheduleRun(runId, 'store-or-network');

  if (!executionId || !scheduleId) {
    return null;
  }

  return <RunExecutionRows scheduleId={scheduleId} executionId={executionId} state={state} />;
}

function RunExecutionRows({
  scheduleId,
  executionId,
  state,
}: {
  scheduleId: string;
  executionId: string;
  state: ExecutionsTabState;
}) {
  const { backendFilters, sort, narrowSearch, ...tableState } = state;

  const queryData = useLazyLoadQuery<ScheduleExecutionsQueryType>(
    scheduleExecutionsRelayQuery,
    // `search` is this page's SCOPE, not a term the user typed: every execution
    // of a fire carries the run's executionId, and search is the only argument
    // that narrows on it (`ScriptExecutionFilterInput` has no execution-id field,
    // and `ScheduleRun` has no executions connection of its own).
    { scheduleId, filter: backendFilters, search: executionId, sort, first: EXECUTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const facetOptions = useExecutionFacetOptions(queryData.scheduleExecutionFilters);

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ScheduleExecutionsPaginationQueryType,
    ScheduleExecutionsFragmentKey
  >(scheduleExecutionsRelayFragment, queryData);

  const executions: UiExecution[] = useMemo(() => {
    const edges = data.scheduleExecutions?.edges ?? [];
    const rows = edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node, edge.node.scriptName)] : []));
    // The query's `search` is spent on the scope above, so the user's term
    // narrows the rows we hold instead. It converges on the whole run rather
    // than the first page: an empty result keeps the infinite-scroll sentinel
    // mounted, which pulls the remaining pages in.
    return narrowExecutions(rows, narrowSearch);
  }, [data.scheduleExecutions?.edges, narrowSearch]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      // The TYPED term, not the scope: `search` only picks the empty-state copy,
      // and the executionId is the page's identity rather than something the
      // user typed.
      search={narrowSearch}
      emptyState={EXECUTIONS_EMPTY_STATE}
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={fetchNextPage}
      loadedCount={data.scheduleExecutions?.edges?.length ?? 0}
      {...tableState}
    />
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

/**
 * One fire of a schedule (Figma 310:33508): the run's own summary over the
 * executions it produced. Reached from the Schedule Runs tab; before this page
 * existed that arrow opened the schedule's Execution History with the run's
 * executionId typed into its search box, which showed the same rows but under
 * the schedule's identity and with no way to link to the run itself.
 *
 * Deliberately NOT `PageLayout`: it takes the subtitle as a prop, so a page whose
 * subtitle is server data would have to suspend as a whole — and with it the
 * search toolbar, which needs no data at all. Here the page draws `PageLayout`'s
 * own two boxes and composes the frozen `TitleBlock` directly, so each part waits
 * only for what it actually reads: the header for the run, the summary for the
 * run, the rows for the run and its executions — and the toolbar for nothing.
 */
export function ScheduleRunDetailsView({ runId }: ScheduleRunDetailsViewProps) {
  return (
    <div className="flex w-full flex-col px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <RunHeader runId={runId} />

      {/* No gap: the executions block carries its own top padding (the sticky
          toolbar's `pt-l`), the same contract the details pages give their tab
          bodies. */}
      <div className="flex flex-1 flex-col">
        <RunSummary runId={runId} />

        {/* The whole shell, exactly as the two Execution History tabs render it —
            same search box, same funnels, same sticky toolbar and boundary. It
            mounts immediately: `clientSearch` is all it needs to know, and the
            run's id reaches the query inside its boundary. */}
        <ExecutionsTabShell clientSearch>{state => <RunExecutions runId={runId} state={state} />}</ExecutionsTabShell>
      </div>
    </div>
  );
}
