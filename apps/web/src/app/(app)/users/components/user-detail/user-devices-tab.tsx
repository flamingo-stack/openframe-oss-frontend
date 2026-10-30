'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type ColumnDef,
  DataTable,
  type Row,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatDistanceToNowStrict } from 'date-fns';
import { memo, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  userDevicesTabQuery$data,
  userDevicesTabQuery as UserDevicesTabQueryType,
} from '@/__generated__/userDevicesTabQuery.graphql';
import { liveColumnMeta, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { UserTabHeading } from './user-tab-heading';

/**
 * The selected account's devices (S3), read whole. `managed` holds the directory devices an agent machine is linked
 * to and stays empty until wave W3; `unmanaged` holds the ones no agent runs on. W1 serves neither the machine nor the
 * device's customers, so both sections show the directory record alone.
 */
const userDevicesTabQuery = graphql`
  query userDevicesTabQuery($id: ID!) {
    directoryAccount(id: $id) {
      devices {
        managed {
          directoryDevice {
            id
            displayName
            operatingSystem
            lastSeenAt
          }
        }
        unmanaged {
          directoryDevice {
            id
            displayName
            operatingSystem
            lastSeenAt
          }
        }
      }
    }
  }
`;

type Devices = NonNullable<userDevicesTabQuery$data['directoryAccount']>['devices'];

const DEVICE_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-[2] min-w-0' },
  // A tablet keeps Device and OS (Figma 1019:608), a phone the device alone (1019:35893).
  os: { id: 'os', header: 'OS', width: 'flex-1 min-w-0', hideAt: 'md' },
  // The rows open nothing until W3 links a machine; the gutter keeps Figma's columns (1014:1660), a phone's row drops it.
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md' },
} satisfies Record<string, TableSkeletonColumn>;

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface DeviceRow {
  id: string;
  name?: string;
  /** When the device was last seen. */
  detail?: string | null;
  os?: string | null;
}

function lastSeen(lastSeenAt: string | null | undefined): string | null {
  const at = lastSeenAt ? new Date(lastSeenAt) : null;
  return at && !Number.isNaN(at.getTime())
    ? `Last Online: ${formatDistanceToNowStrict(at, { addSuffix: true })}`
    : null;
}

function toRows(devices: Devices['unmanaged']): DeviceRow[] {
  return devices.map(({ directoryDevice }) => ({
    id: directoryDevice.id,
    name: directoryDevice.displayName,
    detail: lastSeen(directoryDevice.lastSeenAt),
    os: directoryDevice.operatingSystem,
  }));
}

function DeviceCell({ row }: { row: DeviceRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText className={loading ? 'w-32' : undefined}>{row.name ?? ''}</TruncateText>
      <TruncateText variant="h6" tone="secondary" className={loading ? 'w-24' : undefined}>
        {row.detail ?? ''}
      </TruncateText>
    </div>
  );
}

/** The OS mark and the provider's own OS string (Figma 1014:1707); a string the mark does not know keeps the text. */
function OsCell({ row }: { row: DeviceRow }) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <OSTypeBadge osType={row.os ?? undefined} iconOnly iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      <TruncateText loading={row.os === undefined}>{row.os ?? '—'}</TruncateText>
    </div>
  );
}

const COLUMNS: ColumnDef<DeviceRow>[] = [
  {
    id: DEVICE_COLUMNS.device.id,
    header: DEVICE_COLUMNS.device.header,
    cell: ({ row }: { row: Row<DeviceRow> }) => <DeviceCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(DEVICE_COLUMNS.device),
  },
  {
    id: DEVICE_COLUMNS.os.id,
    header: DEVICE_COLUMNS.os.header,
    cell: ({ row }: { row: Row<DeviceRow> }) => <OsCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(DEVICE_COLUMNS.os),
  },
  { id: DEVICE_COLUMNS.open.id, cell: () => null, enableSorting: false, meta: liveColumnMeta(DEVICE_COLUMNS.open) },
];

const getRowId = (row: DeviceRow) => row.id;
const DEVICES_SKELETON_ROWS = 2;

/** One section's table, from the rows it is handed (`null` while they are read). */
function DeviceSection({ title, rows }: { title: string; rows: readonly DeviceRow[] | null }) {
  const loading = useLoadingScope();
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<DeviceRow>(DEVICES_SKELETON_ROWS) : null),
    [loading],
  );
  const table = useDataTable<DeviceRow>({
    data: placeholderRows ?? ((rows ?? []) as DeviceRow[]),
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xs)]">
      <h3 className="text-ods-text-secondary text-h5">{title}</h3>
      <LiveTable
        table={table}
        skeletonRows={DEVICES_SKELETON_ROWS}
        loadingCells={loading}
        stickyHeader={false}
        itemName="result"
        emptyState={oneLineEmptyState('No devices.')}
      />
    </section>
  );
}

const MANAGED = 'Managed by OpenFrame';
const NOT_MANAGED = 'Not managed by OpenFrame';

/**
 * The heading and the two sections (D5): agent machines, then the devices only the directory knows. A section with
 * nothing in it is left out; with no device at all, one line says so.
 */
function DevicesSections({ devices }: { devices: Devices | null }) {
  const managed = devices ? toRows(devices.managed) : [];
  const unmanaged = devices ? toRows(devices.unmanaged) : null;
  const none = devices !== null && managed.length === 0 && unmanaged?.length === 0;
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <UserTabHeading title="Devices" />
      {/* The table's own empty state, as on the other two tabs. */}
      {none && <DataTable.Empty {...oneLineEmptyState('No devices are tied to this user.')} />}
      {managed.length > 0 && <DeviceSection title={MANAGED} rows={managed} />}
      {(unmanaged === null || unmanaged.length > 0) && <DeviceSection title={NOT_MANAGED} rows={unmanaged} />}
    </div>
  );
}

/** User page → Devices (Figma 1014:1660). `memo`'d: `TabNavigation` defers the body. */
export const UserDevicesTab = memo(function UserDevicesTabImpl({
  id,
  loading = false,
}: {
  id: string;
  loading?: boolean;
}) {
  return (
    <LoadingSuspense live label="Loading devices" gated={loading}>
      <UserDevicesReader id={id} />
    </LoadingSuspense>
  );
});

function UserDevicesReader({ id }: { id: string }) {
  if (useLoadingScope()) return <DevicesSections devices={null} />;
  return <UserDevicesQuery id={id} />;
}

function UserDevicesQuery({ id }: { id: string }) {
  const retryKey = useRetryKey();
  const { directoryAccount } = useLazyLoadQuery<UserDevicesTabQueryType>(
    userDevicesTabQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // A missing account is the header's to say ("User not found").
  if (!directoryAccount) return null;
  return <DevicesSections devices={directoryAccount.devices} />;
}
