'use client';

import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type DateRange,
  EntityImage,
  GRID_MIN_WIDTH,
  type Row,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { readInlineData } from 'relay-runtime';
import type { tenantRemoteSessionsRelay_row$key as TenantSessionRowKey } from '@/__generated__/tenantRemoteSessionsRelay_row.graphql';
import type { tenantRemoteSessionsRelayQuery$variables as TenantSessionsVariables } from '@/__generated__/tenantRemoteSessionsRelayQuery.graphql';
import type { TableDateFilter } from '@/app/components/shared/date-column-header';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { ValueGridCell } from '@/app/components/shared/value-grid-cell';
import { ValueText } from '@/app/components/shared/value-text';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { RemoteSessionListState, RemoteSessionSortField, SortDirection } from '@/generated/schema-enums';
import { tenantRemoteSessionsRelayRowFragment } from '@/graphql/remote-sessions/tenant-remote-sessions-relay';
import { dateRangeToInstantBounds } from '@/lib/date-filter-params';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { customerLogoUrl, fromWireSession, readSession } from '../../services/session-recordings-api-service';
import type { RecordingSummary } from '../../types/session-recording';
import { REMOTE_SESSION_COLUMNS } from './remote-session-column-layout';
import { REMOTE_SESSION_GRID_ACTIONS, remoteSessionColumns } from './remote-session-columns';
import { type ExpiresFilterValue, isRecordingGone, type LiveRows } from './session-status';

// The tenant-wide Remote Sessions page (the Devices page's second tab): the
// device tab's session table with a DEVICE and a CUSTOMER column, filtered,
// sorted and paged on the server.

/** One row: the device tab's session plus where it ran. */
export interface TenantSessionRow extends RecordingSummary {
  /** Null when the device is gone. */
  device: { machineId: string; name: string; hostname: string | null } | null;
  customer: { id: string | null; name: string; logoUrl: string | null } | null;
}

/** One row from the paged list or the running-sessions poll; both spread the same fragment. */
export function toTenantSessionRow(ref: TenantSessionRowKey): TenantSessionRow {
  const node = readInlineData(tenantRemoteSessionsRelayRowFragment, ref);
  const session = readSession(node);
  const { device } = node;
  const organization = session.organization;
  return {
    ...fromWireSession(session),
    device: device
      ? {
          machineId: device.machineId,
          name: device.displayName || device.hostname || device.machineId,
          hostname: device.hostname ?? null,
        }
      : null,
    customer: organization
      ? {
          id: organization.organizationId ?? null,
          name: organization.name,
          logoUrl: customerLogoUrl(organization, device) ?? null,
        }
      : null,
  };
}

/** Figma 2539-21701: SESSION / DEVICE / CUSTOMER / EXPIRES; tablet drops CUSTOMER, mobile keeps SESSION only. */
export const TENANT_SESSION_COLUMNS = {
  session: REMOTE_SESSION_COLUMNS.session,
  device: { id: 'device', header: 'DEVICE', width: 'flex-1 min-w-0', hideAt: 'md' },
  customer: { id: 'customer', header: 'CUSTOMER', width: 'flex-1 min-w-0', hideAt: 'lg' },
  expires: REMOTE_SESSION_COLUMNS.expires,
  actions: REMOTE_SESSION_COLUMNS.actions,
} as const satisfies Record<string, TableSkeletonColumn>;

/** The page's URL state: the header funnels and the SESSION calendar. */
export interface TenantSessionsParams {
  device: string[];
  customer: string[];
  expires: string[];
  dateFrom: string;
  dateTo: string;
  sortDir: string;
}

const EXPIRES_TO_STATE: Record<ExpiresFilterValue, RemoteSessionListState> = {
  kept: RemoteSessionListState.KEPT,
  expiring: RemoteSessionListState.EXPIRING,
  expired: RemoteSessionListState.EXPIRED,
};

type TenantSessionsQueryVars = Required<Pick<TenantSessionsVariables, 'filter' | 'sort'>>;

/**
 * The query's `filter` and `sort` from the URL state. The server takes one
 * customer and one recording state, so those funnels hold a single pick (the
 * last one, see {@link keepLastPick}); devices are a list. The picked calendar
 * days become local-day instants, and the sort is always sent - the header
 * arrow claims an order, and that claim should not rest on a server default.
 */
export function tenantSessionsVariables(
  params: TenantSessionsParams,
  dateRange: DateRange | undefined,
): TenantSessionsQueryVars {
  const bounds = dateRangeToInstantBounds(dateRange);
  const organizationId = params.customer.at(-1);
  const state = EXPIRES_TO_STATE[params.expires.at(-1) as ExpiresFilterValue];
  return {
    filter: {
      ...(params.device.length > 0 && { deviceIds: params.device }),
      ...(organizationId && { organizationId }),
      ...(state && { recordingState: state }),
      ...(bounds.from && { from: bounds.from }),
      ...(bounds.to && { to: bounds.to }),
    },
    sort: {
      field: RemoteSessionSortField.DATE,
      direction: params.sortDir === 'asc' ? SortDirection.ASC : SortDirection.DESC,
    },
  };
}

/**
 * A single-value filter behind a multi-select funnel: the newest pick replaces
 * the one before it, and clearing the funnel clears the value.
 */
export function keepLastPick(previous: readonly string[], next: readonly string[]): string[] {
  const added = next.filter(value => !previous.includes(value));
  if (added.length > 0) return [added[added.length - 1]];
  return next.slice(-1);
}

interface FilterOption {
  id: string;
  value: string;
  label: string;
}

export interface TenantSessionColumnsOptions {
  dateFilter: TableDateFilter;
  deviceOptions: FilterOption[];
  customerOptions: FilterOption[];
  /** The device and customer options are still loading: their funnels draw inert instead of popping in. */
  optionsPending: boolean;
  now: number;
  /** Set while Watch live is on (the device tab's own rule). */
  liveRows: LiveRows | null;
  onOpen: (row: TenantSessionRow) => void;
  onDelete: (row: TenantSessionRow) => void;
  /** The table's layout (the device tab's own option): `grid` gives Delete and Open a column each. Default `cards`. */
  layout?: TableLayout;
}

/** The device's icon, name and hostname. On a loading row the icon is drawn real and both lines draw their bars. */
function DeviceCell({ row }: { row: TenantSessionRow }) {
  const loading = useLoadingScope() && !row.device;
  if (!loading && !row.device) {
    return <ValueText value={null} />;
  }
  const { name = '', hostname = null } = row.device ?? {};
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <MonitorIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />
      <div className="flex min-w-0 flex-col justify-center">
        <TruncateText tone={isRecordingGone(row) ? 'secondary' : 'primary'}>{name}</TruncateText>
        {(loading || (hostname && hostname !== name)) && (
          <TruncateText variant="h6" tone="secondary">
            {hostname ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The customer's logo and name. On a loading row the image and the name draw their own loading forms. */
function CustomerCell({ row }: { row: TenantSessionRow }) {
  const loading = useLoadingScope() && !row.customer;
  if (!loading && !row.customer?.name) {
    return <ValueText value={null} />;
  }
  const { name = '', logoUrl = null } = row.customer ?? {};
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-sf)]">
      <EntityImage
        src={logoUrl}
        alt={name}
        sizeClassName="size-12"
        className="shrink-0 rounded-[4px] border border-ods-border"
      />
      <TruncateText tone={isRecordingGone(row) ? 'secondary' : 'primary'}>{name}</TruncateText>
    </div>
  );
}

/** The grid's one line: the device's icon and name, the hostname after it when it differs. */
function DeviceGridCell({ row }: { row: TenantSessionRow }) {
  const loading = useLoadingScope() && !row.device;
  if (!loading && !row.device) return <ValueGridCell value={null} />;
  const { name = '', hostname = null } = row.device ?? {};
  return (
    <DataTable.Cell
      leading={{ type: 'icon', icon: <MonitorIcon className="size-5" /> }}
      text={name}
      tone={isRecordingGone(row) ? 'secondary' : 'primary'}
      secondary={hostname && hostname !== name ? hostname : undefined}
    />
  );
}

/** The grid's one line: the customer's logo and name. */
function CustomerGridCell({ row }: { row: TenantSessionRow }) {
  const loading = useLoadingScope() && !row.customer;
  if (!loading && !row.customer?.name) return <ValueGridCell value={null} />;
  const { name = '', logoUrl = null } = row.customer ?? {};
  return (
    <DataTable.Cell
      leading={{ type: 'image', src: logoUrl, alt: name }}
      text={name}
      tone={isRecordingGone(row) ? 'secondary' : 'primary'}
    />
  );
}

/**
 * The page's columns: SESSION, EXPIRES and the Delete / Open actions are the
 * device tab's own (same tags, cells and row rules), with DEVICE and CUSTOMER
 * between them. Filtering happens on the server, so the funnels only report
 * what was picked - the table filters nothing itself.
 */
export function tenantSessionColumns({
  dateFilter,
  deviceOptions,
  customerOptions,
  optionsPending,
  now,
  liveRows,
  onOpen,
  onDelete,
  layout = 'cards',
}: TenantSessionColumnsOptions): ColumnDef<TenantSessionRow>[] {
  const shared = remoteSessionColumns<TenantSessionRow>({
    dateFilter,
    employeeOptions: [],
    now,
    liveRows,
    onOpen,
    onDelete,
    layout,
  });
  const pick = (id: string): ColumnDef<TenantSessionRow> => {
    const column = shared.find(candidate => candidate.id === id);
    if (!column) throw new Error(`No shared session column "${id}"`);
    return column;
  };

  return [
    pick(TENANT_SESSION_COLUMNS.session.id),
    {
      id: TENANT_SESSION_COLUMNS.device.id,
      header: TENANT_SESSION_COLUMNS.device.header,
      accessorFn: (row: TenantSessionRow) => row.device?.machineId ?? '',
      cell: ({ row }: { row: Row<TenantSessionRow> }) => <DeviceCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 280,
      minSize: GRID_MIN_WIDTH.icon,
      meta: liveColumnMeta(TENANT_SESSION_COLUMNS.device, {
        label: 'Device',
        filter: { options: deviceOptions, pending: optionsPending },
        gridCell: ({ row }: { row: Row<TenantSessionRow> }) => <DeviceGridCell row={row.original} />,
      }),
    },
    {
      id: TENANT_SESSION_COLUMNS.customer.id,
      header: TENANT_SESSION_COLUMNS.customer.header,
      accessorFn: (row: TenantSessionRow) => row.customer?.id ?? '',
      cell: ({ row }: { row: Row<TenantSessionRow> }) => <CustomerCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 260,
      minSize: GRID_MIN_WIDTH.media,
      meta: liveColumnMeta(TENANT_SESSION_COLUMNS.customer, {
        label: 'Customer',
        filter: { options: customerOptions, pending: optionsPending },
        gridCell: ({ row }: { row: Row<TenantSessionRow> }) => <CustomerGridCell row={row.original} />,
      }),
    },
    pick(TENANT_SESSION_COLUMNS.expires.id),
    // The card rows' one actions column, or the grid's Delete and Open columns.
    ...(layout === 'grid'
      ? [pick(REMOTE_SESSION_GRID_ACTIONS.delete), pick(REMOTE_SESSION_GRID_ACTIONS.open)]
      : [pick(TENANT_SESSION_COLUMNS.actions.id)]),
  ];
}
