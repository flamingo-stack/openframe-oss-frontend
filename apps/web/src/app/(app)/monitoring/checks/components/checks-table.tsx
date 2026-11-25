'use client';

import { PenEditIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuItem,
  type ColumnDef,
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
import { InsightSeverity } from '@/generated/schema-enums';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { formatDefaultThreshold, overrideCountLabel } from '../utils/check-labels';
import type { Check } from '../utils/check-transform';
import { CHECK_COLUMNS } from './checks-table-columns';

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

/** The default for every device, then how many overrides change it: "Below 10% · 7 overrides". */
function ThresholdCell({ check }: { check?: Check }) {
  return (
    <div className="flex min-w-0 items-baseline gap-[var(--spacing-system-xs)]">
      <TruncateText>{check ? formatDefaultThreshold(check) : ''}</TruncateText>
      {check && check.overrideCount > 0 && (
        <span className="shrink-0 whitespace-nowrap text-ods-text-secondary text-h6">
          · {overrideCountLabel(check.overrideCount)}
        </span>
      )}
    </div>
  );
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

function ActionsCell({ check, actions }: { check?: Check; actions?: CheckRowActions | null }) {
  if (!check || !actions) return null;
  const items: ActionsMenuItem[] = [];
  // An on/off check has no default threshold to edit: its default is the switch.
  if (check.parameters.length > 0) {
    items.push({
      id: 'edit-default',
      label: 'Edit Default',
      icon: <PenEditIcon className="size-6 text-ods-text-secondary" />,
      disabled: actions.busy,
      onClick: actions.editDefault,
    });
  }
  items.push({
    id: 'add-override',
    label: 'Add Override',
    icon: <PlusCircleIcon className="size-6 text-ods-text-secondary" />,
    disabled: actions.busy,
    onClick: actions.addOverride,
  });
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <ActionsMenuDropdown groups={[{ items }]} />
    </div>
  );
}

type CellProps = { row: Row<CheckTableRow> };

const CHECK_TABLE_COLUMNS: ColumnDef<CheckTableRow>[] = [
  {
    id: CHECK_COLUMNS.check.id,
    header: CHECK_COLUMNS.check.header,
    accessorFn: row => row.check?.name ?? '',
    sortingFn: 'alphanumeric',
    cell: ({ row }: CellProps) => <CheckCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.check),
  },
  {
    id: CHECK_COLUMNS.severity.id,
    header: CHECK_COLUMNS.severity.header,
    accessorFn: row => row.check?.severity ?? '',
    enableSorting: false,
    filterFn: multiSelectFilterFn,
    cell: ({ row }: CellProps) => <SeverityCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.severity, { label: 'Severity', filter: { options: SEVERITY_FILTER_OPTIONS } }),
  },
  {
    id: CHECK_COLUMNS.threshold.id,
    header: CHECK_COLUMNS.threshold.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <ThresholdCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.threshold),
  },
  {
    id: CHECK_COLUMNS.enabled.id,
    header: CHECK_COLUMNS.enabled.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <EnabledCell check={row.original.check} actions={row.original.actions} />,
    meta: liveColumnMeta(CHECK_COLUMNS.enabled),
  },
  {
    id: CHECK_COLUMNS.actions.id,
    enableSorting: false,
    cell: ({ row }: CellProps) => <ActionsCell check={row.original.check} actions={row.original.actions} />,
    meta: liveColumnMeta(CHECK_COLUMNS.actions),
  },
  {
    id: CHECK_COLUMNS.open.id,
    enableSorting: false,
    cell: ({ row }: CellProps) => (
      <OpenRowButton
        label={row.original.check ? `Open ${row.original.check.name}` : 'Open check'}
        onClick={() => row.original.open?.()}
        disabled={!row.original.open}
      />
    ),
    meta: liveColumnMeta(CHECK_COLUMNS.open),
  },
];

/**
 * Every built-in check with its default for all devices; a click opens its page. In a loading scope
 * (or before its rows) it is the same columns over placeholder rows.
 */
export function ChecksTable({ rows }: { rows?: CheckTableRow[] }) {
  if (useLoadingScope() || !rows) {
    return <LiveTable columns={CHECK_TABLE_COLUMNS} skeletonRows={CHECKS_SKELETON_ROWS} itemName="check" />;
  }
  return <ChecksTableLive rows={rows} />;
}

function ChecksTableLive({ rows }: { rows: CheckTableRow[] }) {
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
    />
  );
}
