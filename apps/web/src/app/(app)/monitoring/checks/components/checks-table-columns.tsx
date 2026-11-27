'use client';

import {
  type ColumnDef,
  GRID_ACTION_COLUMN_SIZE,
  type Row,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { INCIDENT_SEVERITY_LABELS, labelOf } from '@/app/(app)/incidents/utils/incident-labels';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { InsightSeverity } from '@/generated/schema-enums';
import { multiSelectFilterFn } from '@/lib/table-filters';
import {
  ActionsCell,
  CheckCell,
  EnabledCell,
  ExceptionsCell,
  OpenCell,
  SeverityCell,
  ThresholdCell,
} from './checks-table-cells';
import type { CheckTableRow } from './checks-table-row';

/** Column layout of the Checks list, read by its live columns and its loading form alike. */
export const CHECK_COLUMNS = {
  check: { id: 'check', header: 'Check', width: 'flex-1 min-w-0', sortable: true },
  severity: { id: 'severity', header: 'Severity', width: 'w-[120px]', hideAt: 'md' },
  threshold: { id: 'threshold', header: 'Threshold', width: 'w-[200px] content-lg:w-[240px]', hideAt: 'md' },
  exceptions: { id: 'exceptions', header: 'Exceptions', width: 'w-[112px]', hideAt: 'lg' },
  enabled: { id: 'enabled', header: 'Enabled', width: 'w-[72px] content-md:w-[96px]' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

/**
 * The data columns' widths in the grid table, in px (the design's, 1056px of table). The design's Incidents and
 * Last edited columns have no data in the API yet, so Check takes their width; Enabled, the last data column, takes
 * whatever a wider table adds.
 */
export const CHECK_GRID_SIZES = { check: 478, severity: 116, threshold: 170, exceptions: 100, enabled: 80 } as const;

const SEVERITY_FILTER_OPTIONS = Object.values(InsightSeverity).map(severity => ({
  id: severity,
  label: labelOf(INCIDENT_SEVERITY_LABELS, severity),
  value: severity,
}));

type CellProps = { row: Row<CheckTableRow> };

export const CHECK_TABLE_COLUMNS: ColumnDef<CheckTableRow>[] = [
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
