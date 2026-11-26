'use client';

import {
  ArrowRightUpIcon,
  BuildingIcon,
  MonitorIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuItem,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import { useState } from 'react';
import { LiveTable } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDate } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { formatOverrideThreshold, OVERRIDE_SCOPE_LABELS } from '../utils/check-labels';
import { type Check, type CheckOverride, OVERRIDE_SCOPE_TYPES } from '../utils/check-transform';

/** The rows an Exceptions table holds while it has none to draw. */
const OVERRIDES_SKELETON_ROWS = 3;

/** Column layout of a check's Exceptions table. */
const OVERRIDE_COLUMNS = {
  appliesTo: { id: 'appliesTo', header: 'Applies to', width: 'flex-1 min-w-0' },
  threshold: { id: 'threshold', header: 'Threshold', width: 'w-[160px] content-md:w-[190px]' },
  devices: { id: 'devices', header: 'Devices', width: 'w-[100px]', hideAt: 'md' },
  updated: { id: 'updated', header: 'Updated', width: 'w-[150px]', hideAt: 'lg' },
  by: { id: 'by', header: 'By', width: 'w-[170px]', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** What an exception row does, for an admin or owner; a reader's rows have none. */
export interface OverrideRowActions {
  busy: boolean;
  edit: () => void;
  delete: () => void;
}

/** The customer's devices or the device itself; none for a tag, which the device list cannot filter by alone. */
export interface OverrideDevicesTarget {
  label: string;
  href: string;
}

export interface OverrideTableRow {
  id: string;
  check: Check;
  override: CheckOverride;
  devices: OverrideDevicesTarget | null;
  actions: OverrideRowActions | null;
}

const SCOPE_FILTER_OPTIONS = OVERRIDE_SCOPE_TYPES.map(type => ({
  id: type,
  label: OVERRIDE_SCOPE_LABELS[type],
  value: type,
}));

function ScopeIcon({ type }: { type: string }) {
  const className = 'size-5 shrink-0 text-ods-text-secondary';
  if (type === InsightCheckScopeType.DEVICE) return <MonitorIcon className={className} />;
  if (type === InsightCheckScopeType.TAG) return <TagIcon className={className} />;
  return <BuildingIcon className={className} />;
}

function AppliesToCell({ override }: { override: CheckOverride }) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <ScopeIcon type={override.scopeType} />
      <TruncateText>{override.name ?? 'Removed'}</TruncateText>
    </div>
  );
}

function ThresholdCell({ check, override }: { check: Check; override: CheckOverride }) {
  return <TruncateText>{formatOverrideThreshold(check, override)}</TruncateText>;
}

/** How many devices the exception covers, a link to them where the device list can show them. */
function DevicesCell({ count, target }: { count: number; target: OverrideDevicesTarget | null }) {
  if (!target) return <TruncateText>{String(count)}</TruncateText>;
  return (
    <Link
      data-no-row-click
      href={target.href}
      className="pointer-events-auto truncate text-ods-accent text-h4 hover:text-ods-accent-hover"
      aria-label={`${target.label}: ${count}`}
    >
      {count}
    </Link>
  );
}

function ActionsCell({
  actions,
  devices,
}: {
  actions: OverrideRowActions | null;
  devices: OverrideDevicesTarget | null;
}) {
  if (!actions) return null;
  const items: ActionsMenuItem[] = [{ id: 'edit', label: 'Edit', disabled: actions.busy, onClick: actions.edit }];
  if (devices) {
    items.push({
      id: 'open',
      label: devices.label,
      href: devices.href,
      iconAction: {
        icon: <ArrowRightUpIcon className="size-5" />,
        'aria-label': `${devices.label} in new tab`,
        href: devices.href,
        openInNewTab: true,
      },
    });
  }
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <ActionsMenuDropdown
        groups={[
          { items },
          { items: [{ id: 'delete', label: 'Delete', danger: true, disabled: actions.busy, onClick: actions.delete }] },
        ]}
      />
    </div>
  );
}

type CellProps = { row: Row<OverrideTableRow> };

const OVERRIDE_TABLE_COLUMNS: ColumnDef<OverrideTableRow>[] = [
  {
    id: OVERRIDE_COLUMNS.appliesTo.id,
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
    header: OVERRIDE_COLUMNS.threshold.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <ThresholdCell check={row.original.check} override={row.original.override} />,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.threshold),
  },
  {
    id: OVERRIDE_COLUMNS.devices.id,
    header: OVERRIDE_COLUMNS.devices.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => (
      <DevicesCell count={row.original.override.deviceCount} target={row.original.devices} />
    ),
    meta: liveColumnMeta(OVERRIDE_COLUMNS.devices),
  },
  {
    id: OVERRIDE_COLUMNS.updated.id,
    header: OVERRIDE_COLUMNS.updated.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => (
      <TruncateText>
        {row.original.override.updatedAt ? formatDate(row.original.override.updatedAt) : EMPTY_VALUE}
      </TruncateText>
    ),
    meta: liveColumnMeta(OVERRIDE_COLUMNS.updated),
  },
  {
    id: OVERRIDE_COLUMNS.by.id,
    header: OVERRIDE_COLUMNS.by.header,
    enableSorting: false,
    cell: ({ row }: CellProps) => <TruncateText>{row.original.override.updatedBy ?? EMPTY_VALUE}</TruncateText>,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.by),
  },
  {
    id: OVERRIDE_COLUMNS.actions.id,
    enableSorting: false,
    cell: ({ row }: CellProps) => <ActionsCell actions={row.original.actions} devices={row.original.devices} />,
    meta: liveColumnMeta(OVERRIDE_COLUMNS.actions),
  },
];

/** A check's exceptions, the most specific first (the API's order); a click edits one. */
export function OverridesTable({ rows }: { rows: OverrideTableRow[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useDataTable<OverrideTableRow>({
    data: rows,
    columns: OVERRIDE_TABLE_COLUMNS,
    getRowId: (row: OverrideTableRow) => row.id,
    clientSideFiltering: true,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
  });
  return (
    <LiveTable
      table={table}
      skeletonRows={OVERRIDES_SKELETON_ROWS}
      itemName="exception"
      onRowClick={(row: OverrideTableRow) => row.actions?.edit()}
    />
  );
}
