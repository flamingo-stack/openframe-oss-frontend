'use client';

import {
  type ActionsMenuItem,
  type ColumnDef,
  GRID_ACTION_COLUMN_SIZE,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  Switch,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { INCIDENT_SEVERITY_LABELS, labelOf } from '@/app/(app)/incidents/utils/incident-labels';
import { LiveTable } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { InsightSeverity } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { formatDefaultThreshold } from '../utils/check-labels';
import type { Check } from '../utils/check-transform';
import { CHECK_COLUMNS, CHECK_GRID_SIZES } from './checks-table-columns';
import { RowMenuCell } from './row-menu-cell';

/** The built-in catalog's size: the rows the table holds while it loads. */
export const CHECKS_SKELETON_ROWS = 15;

/** What a row does, for an admin or owner; a reader's rows have none. */
export interface CheckRowActions {
  busy: boolean;
  toggle: (enabled: boolean) => void;
  editDefault: () => void;
  addOverride: () => void;
}

/**
 * A row and everything its cells draw. It rides IN the row data, not in the column closures: the table
 * memoizes a row on its object, so a cell reading the columns' closure would keep what it saw first.
 * `check` is absent on a loading row, whose cells draw their loading forms.
 */
export interface CheckTableRow {
  id: string;
  check?: Check;
  actions?: CheckRowActions | null;
  open?: () => void;
}

const SEVERITY_FILTER_OPTIONS = Object.values(InsightSeverity).map(severity => ({
  id: severity,
  label: labelOf(INCIDENT_SEVERITY_LABELS, severity),
  value: severity,
}));

function CheckCell({ check }: { check?: Check }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText>{check?.name ?? ''}</TruncateText>
      {/* Severity and Threshold are hidden below md; their values move under the name. */}
      <div className="min-w-0 content-md:hidden">
        <TruncateText variant="h6" tone="secondary">
          {check ? `${labelOf(INCIDENT_SEVERITY_LABELS, check.severity)} · ${formatDefaultThreshold(check)}` : ''}
        </TruncateText>
      </div>
    </div>
  );
}

function SeverityCell({ check }: { check?: Check }) {
  // A column flexbox: `items-start` keeps the tag at its own width, as in the incident lists.
  return (
    <div className="flex min-w-0 flex-col items-start justify-center">
      <IncidentSeverityTag severity={check?.severity} />
    </div>
  );
}

/** The default for every device: "Below 10%", "On / off". */
function ThresholdCell({ check }: { check?: Check }) {
  return <TruncateText>{check ? formatDefaultThreshold(check) : ''}</TruncateText>;
}

/** How many exceptions change the default; the empty mark when none does. */
function ExceptionsCell({ check }: { check?: Check }) {
  if (!check) return <TruncateText>{''}</TruncateText>;
  return <TruncateText>{check.overrideCount > 0 ? String(check.overrideCount) : EMPTY_VALUE}</TruncateText>;
}

function EnabledCell({ check, actions }: { check?: Check; actions?: CheckRowActions | null }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex min-w-0 items-center">
      <Switch
        checked={check?.enabled ?? false}
        onCheckedChange={enabled => actions?.toggle(enabled)}
        disabled={!check || !actions || actions.busy}
        aria-label={check ? `${check.name} for all devices` : 'Loading check'}
      />
    </div>
  );
}

function ActionsCell({
  check,
  actions,
  grid = false,
}: {
  check?: Check;
  actions?: CheckRowActions | null;
  grid?: boolean;
}) {
  if (!check || !actions) return null;
  const items: ActionsMenuItem[] = [];
  // An on/off check has no default threshold to edit: its default is the switch.
  if (check.parameters.length > 0) {
    items.push({
      id: 'edit-default',
      label: 'Edit Default',
      disabled: actions.busy,
      onClick: actions.editDefault,
    });
  }
  items.push({
    id: 'add-exception',
    label: 'Add Exception',
    disabled: actions.busy,
    onClick: actions.addOverride,
  });
  return <RowMenuCell groups={[{ items }]} grid={grid} />;
}

/** The row's ↗: the check's page. Bare in the grid's action column, outlined in card rows. */
function OpenCell({ row, grid = false }: { row: CheckTableRow; grid?: boolean }) {
  return (
    <OpenRowButton
      grid={grid}
      label={row.check ? `Open ${row.check.name}` : 'Open check'}
      onClick={() => row.open?.()}
      disabled={!row.open}
    />
  );
}

type CellProps = { row: Row<CheckTableRow> };

const CHECK_TABLE_COLUMNS: ColumnDef<CheckTableRow>[] = [
  {
    id: CHECK_COLUMNS.check.id,
    header: CHECK_COLUMNS.check.header,
    accessorFn: row => row.check?.name ?? '',
    sortingFn: 'alphanumeric',
    size: CHECK_GRID_SIZES.check,
    cell: ({ row }: CellProps) => <CheckCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.check, {
      label: 'Check',
      // One line in the grid: Severity and Threshold are columns of their own at every width there.
      gridCell: ({ row }: CellProps) => <TruncateText>{row.original.check?.name ?? ''}</TruncateText>,
    }),
  },
  {
    id: CHECK_COLUMNS.severity.id,
    header: CHECK_COLUMNS.severity.header,
    accessorFn: row => row.check?.severity ?? '',
    enableSorting: false,
    filterFn: multiSelectFilterFn,
    size: CHECK_GRID_SIZES.severity,
    cell: ({ row }: CellProps) => <SeverityCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.severity, { label: 'Severity', filter: { options: SEVERITY_FILTER_OPTIONS } }),
  },
  {
    id: CHECK_COLUMNS.threshold.id,
    header: CHECK_COLUMNS.threshold.header,
    enableSorting: false,
    size: CHECK_GRID_SIZES.threshold,
    cell: ({ row }: CellProps) => <ThresholdCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.threshold, { label: 'Threshold' }),
  },
  {
    id: CHECK_COLUMNS.exceptions.id,
    header: CHECK_COLUMNS.exceptions.header,
    enableSorting: false,
    size: CHECK_GRID_SIZES.exceptions,
    cell: ({ row }: CellProps) => <ExceptionsCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.exceptions, { label: 'Exceptions' }),
  },
  {
    id: CHECK_COLUMNS.enabled.id,
    header: CHECK_COLUMNS.enabled.header,
    enableSorting: false,
    size: CHECK_GRID_SIZES.enabled,
    cell: ({ row }: CellProps) => <EnabledCell check={row.original.check} actions={row.original.actions} />,
    meta: liveColumnMeta(CHECK_COLUMNS.enabled, { label: 'Enabled' }),
  },
  {
    id: CHECK_COLUMNS.actions.id,
    enableSorting: false,
    enableHiding: false,
    size: GRID_ACTION_COLUMN_SIZE,
    cell: ({ row }: CellProps) => <ActionsCell check={row.original.check} actions={row.original.actions} />,
    meta: liveColumnMeta(CHECK_COLUMNS.actions, {
      gridKind: 'action',
      gridCell: ({ row }: CellProps) => <ActionsCell check={row.original.check} actions={row.original.actions} grid />,
    }),
  },
  {
    id: CHECK_COLUMNS.open.id,
    enableSorting: false,
    enableHiding: false,
    size: GRID_ACTION_COLUMN_SIZE,
    cell: ({ row }: CellProps) => <OpenCell row={row.original} />,
    meta: liveColumnMeta(CHECK_COLUMNS.open, {
      gridKind: 'action',
      gridCell: ({ row }: CellProps) => <OpenCell row={row.original} grid />,
    }),
  },
];

/** The viewer's column layout of the grid table, kept in the browser. */
const CHECKS_TABLE_STORAGE_KEY = 'insight-checks';

/**
 * Every built-in check with its default for all devices; a click opens its page. In a loading scope
 * (or before its rows) it is the same columns over placeholder rows.
 */
export function ChecksTable({ rows }: { rows?: CheckTableRow[] }) {
  const grid = useTableGrid(CHECKS_TABLE_STORAGE_KEY);
  if (useLoadingScope() || !rows) {
    return <LiveTable columns={CHECK_TABLE_COLUMNS} skeletonRows={CHECKS_SKELETON_ROWS} itemName="check" {...grid} />;
  }
  return <ChecksTableLive rows={rows} grid={grid} />;
}

function ChecksTableLive({ rows, grid }: { rows: CheckTableRow[]; grid: ReturnType<typeof useTableGrid> }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useDataTable<CheckTableRow>({
    data: rows,
    columns: CHECK_TABLE_COLUMNS,
    getRowId: (row: CheckTableRow) => row.id,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });
  return (
    <LiveTable
      table={table}
      skeletonRows={CHECKS_SKELETON_ROWS}
      itemName="check"
      onRowClick={(row: CheckTableRow) => row.open?.()}
      {...grid}
    />
  );
}
