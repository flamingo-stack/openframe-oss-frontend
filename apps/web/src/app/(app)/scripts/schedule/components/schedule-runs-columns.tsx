'use client';

import { ArrowRightUpIcon, Copy01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  type Row,
  Tag,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useCallback, useMemo } from 'react';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { type Initiator, InitiatorIdentity } from '../../shared/components/initiator-identity';
import { executionStatusLabel, executionStatusVariant } from '../../shared/utils/execution-helpers';
import { facetFilter } from '../../shared/utils/facet-options';

/** How many runs load per page. */
export const RUNS_PAGE_SIZE = 20;

/**
 * Column layout — ONE declaration, read by {@link scheduleRunColumns} (the
 * loaded table and its loading state draw the same columns). Widths, `hideAt` and `filterable` were written
 * out twice before, and the copies drifted: the skeleton's Status column lost
 * its `filterable`, so the funnel was missing while loading and popped in with
 * the facets, shifting the label. See `table-column-layout.ts`.
 */
const RUN_COLUMNS = {
  executionId: { id: 'executionId', header: 'Execution', width: 'flex-1 min-w-0', dateFilterable: true },
  status: { id: 'status', header: 'Status', width: 'w-[120px]', filterable: true },
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

/** "Executed by" — an avatar plus either the user's name (linked) or "Scheduled". */
function InitiatorCell({ run }: { run: UiRun }) {
  if (run.isScheduled) {
    return (
      <TruncateText tone="secondary" className="flex-1">
        Scheduled
      </TruncateText>
    );
  }

  return <InitiatorIdentity initiator={run.initiator} size="md" inRow />;
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
      cell: ({ row }: { row: Row<UiRun> }) => (
        <div className="flex">
          <Tag
            label={executionStatusLabel(row.original.status)}
            variant={executionStatusVariant(row.original.status)}
          />
        </div>
      ),
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
      cell: ({ row }: { row: Row<UiRun> }) => (
        <span className="whitespace-nowrap text-ods-text-primary text-h4">
          {row.original.responded}
          <span className="text-ods-text-secondary">/{row.original.total}</span>
        </span>
      ),
      enableSorting: false,
      meta: liveColumnMeta(RUN_COLUMNS.responded),
    },
    {
      // The column's value is the initiator's id so a future server facet can reuse it;
      // the cell renders the name (or "Scheduled" for an automatic fire).
      id: 'initiatorId',
      accessorFn: (run: UiRun) => run.initiator.id,
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
      cell: ({ row }: { row: Row<UiRun> }) => (
        <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
          <Button
            onClick={openInNewTab(runDetailsHref(row.original))}
            variant="outline"
            size="icon"
            leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
            aria-label="Open run details in new tab"
            className="bg-ods-card"
          />
        </div>
      ),
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
