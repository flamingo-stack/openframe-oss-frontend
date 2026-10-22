'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ArrowRightUpIcon, Copy01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  type Row,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useCallback, useMemo } from 'react';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { type Initiator, InitiatorIdentity, toInitiator } from '../../shared/components/initiator-identity';
import { executionStatusLabel, executionStatusVariant } from '../../shared/utils/execution-helpers';
import { facetFilter } from '../../shared/utils/facet-options';

/** How many runs load per page. */
export const RUNS_PAGE_SIZE = 20;

/**
 * Column layout — ONE declaration, read by {@link scheduleRunColumns} (the
 * loaded table and its loading state draw the same columns). Widths and `hideAt` were written out twice
 * before, and the copies drifted. See `table-column-layout.ts`.
 */
const RUN_COLUMNS = {
  executionId: { id: 'executionId', header: 'Execution', width: 'flex-1 min-w-0', dateFilterable: true },
  status: { id: 'status', header: 'Status', width: 'w-[120px]' },
  responded: { id: 'responded', header: 'Devices', width: 'w-[120px]', hideAt: 'lg' },
  initiatorId: { id: 'initiatorId', header: 'Executed by', width: 'flex-1 min-w-0', hideAt: 'md' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** One entry of the Status funnel — the core table's `meta.filter.options` shape. */
export interface RunStatusOption {
  id: string;
  label: string;
  value: string;
  /** Optional: the enum fallback, used until the facet answers, has no count. */
  count?: number;
}

/** One fire of a schedule, in the shape the table renders. */
export interface UiRun {
  id: string;
  executionId: string;
  status: string;
  timestamp: string;
  responded: number;
  total: number;
  /** Who fired it (empty for a scheduled fire). */
  initiator: Initiator;
  /** Scheduled fires carry no initiator — a person only fires a run manually. */
  isScheduled: boolean;
}

/** The run's own page (design 310:33508). */
export function runDetailsHref(run: UiRun): string {
  return routes.scripts.schedules.run(run.id);
}

/** A placeholder row's initiator (the table's loading form): nobody, so its avatar and name draw their loading form. */
const NO_INITIATOR = toInitiator(null);

/** "Executed by" — an avatar plus either the user's name (linked) or "Scheduled". */
function InitiatorCell({ run }: { run: UiRun }) {
  // A row still being read: the avatar and the name draw their loading form (most fires are a person's).
  if (useLoadingScope()) return <InitiatorIdentity initiator={NO_INITIATOR} size="md" inRow />;
  if (run.isScheduled) {
    return (
      <TruncateText tone="secondary" className="flex-1">
        Scheduled
      </TruncateText>
    );
  }

  return <InitiatorIdentity initiator={run.initiator} size="md" inRow />;
}

/** A fire's status as its tag; the tag's own loading form while the row is read. */
function RunStatusCell({ status }: { status: string }) {
  const loading = useLoadingScope();
  return (
    <div className="flex">
      <Tag label={executionStatusLabel(status)} variant={executionStatusVariant(status)} loading={loading} />
    </div>
  );
}

/**
 * "80/150" = devices we have processed at least one result from, over the devices the fire targeted. The denominator
 * is greyed so the eye lands on the number that moves; no slack around the slash, it reads as one value rather than
 * two. A bar on its line while the row is read.
 */
function RunDevicesCell({ run }: { run: UiRun }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h4" className="w-16" />;
  return (
    <span className="whitespace-nowrap text-ods-text-primary text-h4">
      {run.responded}
      <span className="text-ods-text-secondary">/{run.total}</span>
    </span>
  );
}

/** Opens the run's page in a new tab. Static chrome: drawn real while the row is read, and inert. */
function OpenRunButton({ run }: { run: UiRun }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(runDetailsHref(run))}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open run details in new tab"
        className="bg-ods-card"
        disabled={loading}
      />
    </div>
  );
}

/**
 * The Schedule Runs columns. `statusOptions` is the server facet scoped to the
 * current narrowing, so the funnel offers the states these runs actually
 * reached rather than every state the enum can name. `dateFilter` is the
 * dispatched-date sort + range the Execution header hosts — the same control the
 * two Execution History lists carry, on the timestamp that column already shows.
 */
export function useScheduleRunColumns(
  statusOptions: RunStatusOption[],
  dateFilter: TableDateFilter,
): ColumnDef<UiRun>[] {
  const { toast } = useToast();

  const renderRowActions = useCallback(
    (run: UiRun) => {
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'copy-execution-id',
              label: 'Copy Execution ID',
              icon: <Copy01Icon className="h-6 w-6 text-ods-text-secondary" />,
              onClick: () => {
                navigator.clipboard
                  ?.writeText(run.executionId)
                  .then(() => toast({ title: 'Copied', description: 'Execution ID copied', variant: 'success' }))
                  .catch(() => toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' }));
              },
            },
          ],
        },
      ];
      return <ActionsMenuDropdown groups={groups} />;
    },
    [toast],
  );

  return useMemo(
    () => scheduleRunColumns({ statusOptions, dateFilter, renderRowActions }),
    [renderRowActions, statusOptions, dateFilter],
  );
}

/**
 * The table's columns: the loaded table and its loading state draw the same ones. With no `statusOptions`
 * (loading) the Status funnel is pending and the Execution header's calendar is inert.
 */
function scheduleRunColumns({
  statusOptions,
  dateFilter,
  renderRowActions,
}: {
  statusOptions: RunStatusOption[] | null;
  dateFilter: TableDateFilter | null;
  renderRowActions: (run: UiRun) => ReactNode;
}): ColumnDef<UiRun>[] {
  return [
    {
      accessorKey: 'executionId',
      // The cell's first line is the fire's dispatchedAt, which is what the
      // calendar (range + newest/oldest first) narrows and orders.
      header: () => <DateColumnHeader label={RUN_COLUMNS.executionId.header} filter={dateFilter ?? undefined} />,
      // Stretch column: the execution id is a full uuid and this is the one
      // place it is shown in full (it is what the Execution History drill-down
      // and "Copy Execution ID" key on).
      cell: ({ row }: { row: Row<UiRun> }) => (
        <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
          <TruncateText>{row.original.timestamp}</TruncateText>
          <TruncateText variant="h6" tone="secondary">
            {row.original.executionId}
          </TruncateText>
        </div>
      ),
      enableSorting: false,
      meta: liveColumnMeta(RUN_COLUMNS.executionId),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: Row<UiRun> }) => <RunStatusCell status={row.original.status} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(RUN_COLUMNS.status, { filter: facetFilter(statusOptions) }),
    },
    {
      accessorKey: 'responded',
      header: 'Devices',
      // "80/150" = devices we have processed at least one result from, over the
      // devices the fire targeted. The denominator is greyed so the eye lands
      // on the number that moves; no slack around the slash, it reads as one
      // value rather than two.
      cell: ({ row }: { row: Row<UiRun> }) => <RunDevicesCell run={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(RUN_COLUMNS.responded),
    },
    {
      // The column's value is the initiator's id so a future server facet can reuse it;
      // the cell renders the name (or "Scheduled" for an automatic fire).
      id: 'initiatorId',
      // A placeholder row (the table's loading form) has no initiator.
      accessorFn: (run: UiRun) => run.initiator?.id,
      header: 'Executed by',
      cell: ({ row }: { row: Row<UiRun> }) => <InitiatorCell run={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(RUN_COLUMNS.initiatorId, { cellClassName: 'self-stretch' }),
    },
    {
      id: 'actions',
      cell: ({ row }: { row: Row<UiRun> }) => (
        <div
          data-no-row-click
          className="pointer-events-auto flex items-center justify-end gap-[var(--spacing-system-xsf)]"
        >
          {renderRowActions(row.original)}
        </div>
      ),
      enableSorting: false,
      meta: liveColumnMeta(RUN_COLUMNS.actions),
    },
    {
      id: 'open',
      cell: ({ row }: { row: Row<UiRun> }) => <OpenRunButton run={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(RUN_COLUMNS.open),
    },
  ];
}

/** The columns before the first answer: the Status funnel pending, the calendar inert, no row to act on. */
export const SCHEDULE_RUN_LOADING_COLUMNS = scheduleRunColumns({
  statusOptions: null,
  dateFilter: null,
  renderRowActions: () => null,
});
