'use client';

import { ArrowRightUpIcon, Copy01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  DataTable,
  multiSelectFilterFn,
  type Row,
  SquareAvatar,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import {
  liveColumnMeta,
  skeletonColumnMeta,
  type TableSkeletonColumn,
} from '@/app/components/shared/table-column-layout';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { executionStatusLabel, executionStatusVariant } from '../../shared/utils/execution-helpers';

/** How many runs load per page. */
export const RUNS_PAGE_SIZE = 20;

/**
 * Column layout — ONE declaration, read by the live table below and by
 * {@link ScheduleRunsSkeleton}. Widths, `hideAt` and `filterable` were written
 * out twice before, and the copies drifted: the skeleton's Status column lost
 * its `filterable`, so the funnel was missing while loading and popped in with
 * the facets, shifting the label. See `table-column-layout.ts`.
 */
const RUN_COLUMNS = {
  executionId: { id: 'executionId', header: 'Execution', width: 'flex-1 min-w-0' },
  status: { id: 'status', header: 'Status', width: 'w-[120px]', filterable: true },
  responded: { id: 'responded', header: 'Devices', width: 'w-[120px]', hideAt: 'lg' },
  initiatorId: { id: 'initiatorId', header: 'Executed by', width: 'flex-1 min-w-0', hideAt: 'md' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** Render order, shared by the live table and the skeleton. */
const RUN_COLUMN_ORDER: readonly TableSkeletonColumn[] = [
  RUN_COLUMNS.executionId,
  RUN_COLUMNS.status,
  RUN_COLUMNS.responded,
  RUN_COLUMNS.initiatorId,
  // The loaded table ends in two 48px action columns. They carry no header text,
  // but they do carry width — leaving them out of the skeleton laid the `flex-1`
  // columns across ~128px more than they get, and every label jumped left the
  // moment the rows arrived.
  RUN_COLUMNS.actions,
  RUN_COLUMNS.open,
];

/** One entry of the Status funnel — the core table's `meta.filter.options` shape. */
export interface RunStatusOption {
  id: string;
  label: string;
  value: string;
}

/** One fire of a schedule, in the shape the table renders. */
export interface UiRun {
  id: string;
  executionId: string;
  status: string;
  timestamp: string;
  responded: number;
  total: number;
  initiatorId: string;
  initiatorName: string;
  initiatorInitials: string;
  initiatorImage?: string;
  /** Initiator account is DELETED / SELF_DELETED — from `User.status` on the payload. */
  initiatorDeleted: boolean;
  /** Scheduled fires carry no initiator — a person only fires a run manually. */
  isScheduled: boolean;
}

/** The run's own page (design 310:33508). */
export function runDetailsHref(run: UiRun): string {
  return routes.scriptsV2.schedules.run(run.id);
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

  // The initiator id is a User global id; decode it to the raw id the REST-backed
  // employee page expects. `data-no-row-click` stops the row's own navigation so
  // only the user page opens.
  const rawInitiatorId = decodeGlobalId(run.initiatorId)?.rawId ?? run.initiatorId;
  const href = rawInitiatorId ? employeeDetailHref(rawInitiatorId) : null;
  const isDeleted = run.initiatorDeleted;

  const avatar = isDeleted ? (
    <DeletedUserAvatar size="md" />
  ) : (
    <SquareAvatar
      variant="round"
      size="md"
      src={run.initiatorImage}
      fallback={run.initiatorInitials}
      alt={run.initiatorName}
      initialsClassName="text-ods-text-secondary"
    />
  );

  if (!href) {
    return (
      <div className="flex flex-1 items-center gap-[var(--spacing-system-xsf)] min-w-0">
        {avatar}
        <div className="min-w-0 flex-1">
          <TruncateText className={isDeleted ? 'text-ods-error' : undefined}>{run.initiatorName}</TruncateText>
        </div>
      </div>
    );
  }

  return (
    <div data-no-row-click className="flex min-w-0 flex-1 pointer-events-auto">
      <button
        type="button"
        onClick={openInNewTab(href)}
        className="flex w-full items-center gap-[var(--spacing-system-xsf)] min-w-0 text-left"
      >
        {avatar}
        <div className="min-w-0 flex-1">
          <TruncateText className={cn('underline', isDeleted ? 'text-ods-error' : 'text-ods-accent')}>
            {run.initiatorName}
          </TruncateText>
        </div>
      </button>
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
  const router = useRouter();
  const { toast } = useToast();

  const renderRowActions = useCallback(
    (run: UiRun) => {
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'copy-execution-id',
              label: 'Copy Execution ID',
              icon: <Copy01Icon className="w-6 h-6 text-ods-text-secondary" />,
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

  return useMemo<ColumnDef<UiRun>[]>(
    () => [
      {
        accessorKey: 'executionId',
        // The cell's first line is the fire's dispatchedAt, which is what the
        // calendar (range + newest/oldest first) narrows and orders.
        header: () => (
          <DateColumnHeader
            label={RUN_COLUMNS.executionId.header}
            filter={dateFilter}
            ariaLabel="Sort and filter by run date"
          />
        ),
        // Stretch column: the execution id is a full uuid and this is the one
        // place it is shown in full (it is what the Execution History drill-down
        // and "Copy Execution ID" key on).
        cell: ({ row }: { row: Row<UiRun> }) => (
          <div className="flex flex-col justify-center gap-[var(--spacing-system-xxs)] min-w-0">
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
        meta: liveColumnMeta(RUN_COLUMNS.status, { filter: { options: statusOptions } }),
      },
      {
        accessorKey: 'responded',
        header: 'Devices',
        // "80/150" = devices we have processed at least one result from, over the
        // devices the fire targeted. The denominator is greyed so the eye lands
        // on the number that moves; no slack around the slash, it reads as one
        // value rather than two.
        cell: ({ row }: { row: Row<UiRun> }) => (
          <span className="text-h4 text-ods-text-primary whitespace-nowrap">
            {row.original.responded}
            <span className="text-ods-text-secondary">/{row.original.total}</span>
          </span>
        ),
        enableSorting: false,
        meta: liveColumnMeta(RUN_COLUMNS.responded),
      },
      {
        // accessorKey is `initiatorId` so a future server facet can reuse it;
        // the cell renders the name (or "Scheduled" for an automatic fire).
        accessorKey: 'initiatorId',
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
            className="flex gap-[var(--spacing-system-xsf)] items-center justify-end pointer-events-auto"
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
          <div data-no-row-click className="flex items-center justify-end pointer-events-auto">
            <Button
              onClick={() => router.push(runDetailsHref(row.original))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="w-5 h-5" />}
              aria-label="Open run details"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(RUN_COLUMNS.open),
      },
    ],
    [renderRowActions, router, statusOptions, dateFilter],
  );
}

const EMPTY_ROWS: UiRun[] = [];

export function ScheduleRunsSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset?: string } = {}) {
  // The live table's own layout, with `skeletonColumnMeta` turning `filterable`
  // into a filter with no options yet — the header then draws the real control,
  // funnel included, instead of growing one when the facets land. The Execution
  // header's calendar needs no data at all, so it is drawn inert here for the
  // same reason: a bare label would shift when the popover replaced it.
  const columns = useMemo<ColumnDef<UiRun>[]>(
    () =>
      RUN_COLUMN_ORDER.map(column => {
        const label = column.header;
        return {
          id: column.id,
          header: label && column.id === RUN_COLUMNS.executionId.id ? () => <DateColumnHeader label={label} /> : label,
          enableSorting: false,
          meta: skeletonColumnMeta(column),
        };
      }),
    [],
  );

  const table = useDataTable<UiRun>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiRun) => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} />
      <DataTable.Body loading={true} skeletonRows={RUNS_PAGE_SIZE} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}
