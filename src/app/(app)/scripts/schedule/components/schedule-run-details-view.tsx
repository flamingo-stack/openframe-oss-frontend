'use client';

import { NotFoundError, Tag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type PageActionButton,
  Skeleton,
  SquareAvatar,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleExecutionsRelay_query$key as ScheduleExecutionsFragmentKey } from '@/__generated__/scheduleExecutionsRelay_query.graphql';
import type { scheduleExecutionsRelayPaginationQuery as ScheduleExecutionsPaginationQueryType } from '@/__generated__/scheduleExecutionsRelayPaginationQuery.graphql';
import type { scheduleExecutionsRelayQuery as ScheduleExecutionsQueryType } from '@/__generated__/scheduleExecutionsRelayQuery.graphql';
import type { scheduleRunDetailRelayQuery as ScheduleRunDetailQueryType } from '@/__generated__/scheduleRunDetailRelayQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import {
  scheduleExecutionsRelayFragment,
  scheduleExecutionsRelayQuery,
} from '@/graphql/scripts/schedule-executions-relay';
import { scheduleRunDetailRelayQuery } from '@/graphql/scripts/schedule-run-detail-relay';
import { getFullImageUrl } from '@/lib/image-url';
import { decodeGlobalId } from '@/lib/relay-id';
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
import {
  executionStatusLabel,
  executionStatusVariant,
  formatExecutionTimestamp,
  initiatorInitials,
  initiatorName,
} from '../../shared/utils/execution-helpers';

interface ScheduleRunDetailsViewProps {
  /** `ScheduleRun` global id — see `routes.scripts.schedules.run`. */
  runId: string;
}

const PAGE_TITLE = 'Script Schedule Execution Details';

const NO_ACTIONS: PageActionButton[] = [];

/** The schedule tab's placeholder (design 1:48878), named for one fire. */
const EXECUTIONS_EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'This run produced no executions',
};

// ----------------------------------------------------------------
// Info bar
// ----------------------------------------------------------------

/** A value-over-label cell, matching the schedule's own info bar (80px on md+). */
function RunInfoCell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-w-0 flex-col items-start justify-center px-4 py-3 md:h-[80px] md:py-0 ${className ?? ''}`}
    >
      {children}
      <span className="text-ods-text-secondary text-h6">{label}</span>
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
  const isDeleted = isDeletedUserStatus(initiator?.status);

  return (
    <div className="flex w-full flex-col gap-0 overflow-clip rounded-[6px] border border-ods-border bg-ods-card">
      <div className="grid grid-cols-2 border-b border-ods-border md:grid-cols-4">
        {/* Design 310:33508 labels this cell "Script Name". A ScheduleRun has no
            script reference — a fire dispatches whatever scripts the schedule
            held — so the honest equivalent is how many devices answered it. */}
        <RunInfoCell label="Devices Responded" className="border-b border-ods-border md:border-b-0">
          <span className="truncate text-ods-text-primary text-h4">
            {responded} / {total}
          </span>
        </RunInfoCell>
        <RunInfoCell label="Executed by" className="border-b border-ods-border md:border-b-0">
          <div className="flex min-w-0 items-center gap-2">
            {isDeleted ? (
              <DeletedUserAvatar size="sm" />
            ) : (
              <SquareAvatar
                variant="round"
                size="sm"
                src={getFullImageUrl(initiator?.image?.imageUrl, initiator?.image?.hash)}
                fallback={initiatorInitials(initiator)}
                alt={initiatorName(initiator)}
                initialsClassName="text-ods-text-secondary"
              />
            )}
            {initiatorHref ? (
              <a href={initiatorHref} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <TruncateText
                  className={cn(
                    'underline',
                    isDeleted ? 'text-ods-error' : 'text-ods-accent hover:text-ods-accent-hover',
                  )}
                >
                  {initiatorName(initiator)}
                </TruncateText>
              </a>
            ) : (
              <div className="min-w-0 flex-1">
                <TruncateText className={isDeleted ? 'text-ods-error' : undefined}>
                  {initiatorName(initiator)}
                </TruncateText>
              </div>
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
          <TruncateText>{formatExecutionTimestamp(dispatchedAt)}</TruncateText>
        </RunInfoCell>
        <RunInfoCell label="Finish Time">
          <TruncateText>{formatExecutionTimestamp(finishedAt)}</TruncateText>
        </RunInfoCell>
      </div>
    </div>
  );
}

/** Mirrors `RunInfoBar`'s two rows so the header keeps its height while loading. */
function RunInfoBarSkeleton() {
  return (
    <div className="flex w-full flex-col gap-0 overflow-clip rounded-[6px] border border-ods-border bg-ods-card">
      <div className="grid grid-cols-2 border-b border-ods-border md:grid-cols-4">
        {['responded', 'by', 'status', 'spacer'].map(cell => (
          <div key={cell} className="flex min-w-0 flex-col items-start justify-center px-4 py-3 md:h-[80px] md:py-0">
            <div className="text-h4">
              <Skeleton className="inline-block h-3 w-20 max-w-full md:h-4" />
            </div>
            <div className="text-h6">
              <Skeleton className="inline-block h-2.5 w-14 max-w-full md:h-3" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2">
        {['start', 'finish'].map(cell => (
          <div key={cell} className="flex min-w-0 flex-col items-start justify-center px-4 py-3 md:h-[80px] md:py-0">
            <div className="text-h4">
              <Skeleton className="inline-block h-3 w-32 max-w-full md:h-4" />
            </div>
            <div className="text-h6">
              <Skeleton className="inline-block h-2.5 w-16 max-w-full md:h-3" />
            </div>
          </div>
        ))}
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
 * own answer, so this is what waits for it.
 */
function RunHeader({ runId }: ScheduleRunDetailsViewProps) {
  const { executionId, scheduleId } = useScheduleRun(runId, 'store-and-network');

  // Back to the fires of the schedule this run belongs to; a bad id has no
  // schedule to return to, so it falls back to the list.
  const handleBack = useSafeBack(
    scheduleId ? routes.scripts.schedules.details(scheduleId, { tab: 'runs' }) : routes.scripts.schedules.list,
  );

  return (
    <TitleBlock
      title={PAGE_TITLE}
      subtitle={executionId}
      // A run always has an executionId, so the row never collapses once loaded —
      // and the fallback below holds the same line with a bar in it.
      subtitleRow="always"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={NO_ACTIONS}
    />
  );
}

/**
 * `loading` + `while-loading` is what draws the bar where the executionId will
 * land. It costs the title: `loading` is a single flag on the frozen
 * `TitleBlock` and swaps title AND subtitle for bars, even though this page's
 * title is a constant. Splitting them needs a new prop there.
 */
function RunHeaderSkeleton() {
  const handleBack = useSafeBack(routes.scripts.schedules.list);

  return (
    <TitleBlock
      title={PAGE_TITLE}
      loading
      subtitleRow="while-loading"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={NO_ACTIONS}
    />
  );
}

/** The summary island — and the page's single not-found report. */
function RunSummary({ runId }: ScheduleRunDetailsViewProps) {
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
      <Suspense fallback={<RunHeaderSkeleton />}>
        <RunHeader runId={runId} />
      </Suspense>

      {/* No gap: the executions block carries its own top padding (the sticky
          toolbar's `pt-l`), the same contract the details pages give their tab
          bodies. */}
      <div className="flex flex-1 flex-col">
        <Suspense fallback={<RunInfoBarSkeleton />}>
          <RunSummary runId={runId} />
        </Suspense>

        {/* The whole shell, exactly as the two Execution History tabs render it —
            same search box, same funnels, same sticky toolbar and boundary. It
            mounts immediately: `clientSearch` is all it needs to know, and the
            run's id reaches the query inside its boundary. */}
        <ExecutionsTabShell clientSearch>{state => <RunExecutions runId={runId} state={state} />}</ExecutionsTabShell>
      </div>
    </div>
  );
}
