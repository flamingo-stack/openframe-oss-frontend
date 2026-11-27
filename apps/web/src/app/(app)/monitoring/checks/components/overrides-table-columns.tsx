'use client';

import {
  type ColumnDef,
  GRID_ACTION_COLUMN_SIZE,
  type Row,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDate } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { OVERRIDE_SCOPE_LABELS } from '../utils/check-labels';
import { OVERRIDE_SCOPE_TYPES } from '../utils/check-transform';
import { ActionsCell, AppliesToCell, DevicesCell, ThresholdCell } from './overrides-table-cells';
import type { OverrideTableRow } from './overrides-table-row';

/** Column layout of a check's Exceptions table. */
const OVERRIDE_COLUMNS = {
  appliesTo: { id: 'appliesTo', header: 'Applies to', width: 'flex-1 min-w-0' },
  threshold: { id: 'threshold', header: 'Threshold', width: 'w-[160px] content-md:w-[190px]' },
  devices: { id: 'devices', header: 'Devices', width: 'w-[100px]', hideAt: 'md' },
  updated: { id: 'updated', header: 'Updated', width: 'w-[150px]', hideAt: 'lg' },
  by: { id: 'by', header: 'By', width: 'w-[170px]', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** The data columns' widths in the grid table, in px (the design's); By, the last, takes what a wider table adds. */
const OVERRIDE_GRID_SIZES = { appliesTo: 404, threshold: 190, devices: 100, updated: 150, by: 156 } as const;

const SCOPE_FILTER_OPTIONS = OVERRIDE_SCOPE_TYPES.map(type => ({
  id: type,
  label: OVERRIDE_SCOPE_LABELS[type],
  value: type,
}));

type CellProps = { row: Row<OverrideTableRow> };

export const OVERRIDE_TABLE_COLUMNS: ColumnDef<OverrideTableRow>[] = [
  {
    id: OVERRIDE_COLUMNS.appliesTo.id,
    size: OVERRIDE_GRID_SIZES.appliesTo,
    header: OVERRIDE_COLUMNS.appliesTo.header,
    accessorFn: row => row.override.scopeType,
    filterFn: multiSelectFilterFn,
    enableSorting: false,
    cell: ({ row }: CellProps) => <AppliesToCell override={row.original.override} />,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.appliesTo, {
      label: 'Applies to',
      filter: { options: SCOPE_FILTER_OPTIONS },
    }),
  },
  {
    id: OVERRIDE_COLUMNS.threshold.id,
    size: OVERRIDE_GRID_SIZES.threshold,
    header: OVERRIDE_COLUMNS.threshold.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <ThresholdCell check={row.original.check} override={row.original.override} />,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.threshold, { label: 'Threshold' }),
  },
  {
    id: OVERRIDE_COLUMNS.devices.id,
    size: OVERRIDE_GRID_SIZES.devices,
    header: OVERRIDE_COLUMNS.devices.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <DevicesCell count={row.original.override.deviceCount} />,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.devices, { label: 'Devices' }),
  },
  {
    id: OVERRIDE_COLUMNS.updated.id,
    size: OVERRIDE_GRID_SIZES.updated,
    header: OVERRIDE_COLUMNS.updated.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => (
      <TruncateText>
        {row.original.override.updatedAt ? formatDate(row.original.override.updatedAt) : EMPTY_VALUE}
      </TruncateText>
    ),
    meta: liveColumnMeta(OVERRIDE_COLUMNS.updated, { label: 'Updated' }),
  },
  {
    id: OVERRIDE_COLUMNS.by.id,
    size: OVERRIDE_GRID_SIZES.by,
    header: OVERRIDE_COLUMNS.by.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <TruncateText>{row.original.override.updatedBy ?? EMPTY_VALUE}</TruncateText>,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.by, { label: 'By' }),
  },
  {
    id: OVERRIDE_COLUMNS.actions.id,
    enableSorting: false,
    enableHiding: false,
    size: GRID_ACTION_COLUMN_SIZE,
    cell: ({ row }: CellProps) => <ActionsCell actions={row.original.actions} devices={row.original.devices} />,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.actions, {
      gridKind: 'action',
      gridCell: ({ row }: CellProps) => (
        <ActionsCell actions={row.original.actions} devices={row.original.devices} grid />
      ),
    }),
  },
];
