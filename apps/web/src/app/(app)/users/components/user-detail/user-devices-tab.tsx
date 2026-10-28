'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type ColumnDef,
  DataTable,
  EntityImage,
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
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { firstAndCount } from '../../utils/user-presentation';
import { UserTabHeading } from './user-tab-heading';

/**
 * The selected account's devices (contract §2, S3), read whole. `managed` holds agent machines linked to its directory
 * devices and stays empty until wave W3; `unmanaged` holds the directory devices no agent runs on.
 */
const userDevicesTabQuery = graphql`
  query userDevicesTabQuery($id: ID!) {
    directoryAccount(id: $id) {
      devices {
        managed {
          machine {
            machineId
            displayName
            hostname
          }
          directoryDevice {
            id
            operatingSystem
            customers {
              name
              image {
                imageUrl
                hash
              }
            }
          }
        }
        unmanaged {
          directoryDevice {
            id
            displayName
            operatingSystem
            lastSeenAt
            customers {
              name
              image {
                imageUrl
                hash
              }
            }
          }
        }
      }
    }
  }
`;

type Devices = NonNullable<userDevicesTabQuery$data['directoryAccount']>['devices'];
type DeviceCustomers = Devices['unmanaged'][number]['directoryDevice']['customers'];

const DEVICE_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-[2] min-w-0' },
  os: { id: 'os', header: 'OS', width: 'flex-1 min-w-0', hideAt: 'md' },
  // A tablet keeps Device and OS (Figma 1019:608), a phone the device alone (1019:35893).
  customer: { id: 'customer', header: 'Customer', width: 'flex-[2] min-w-0', hideAt: 'lg' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface DeviceRow {
  id: string;
  name?: string;
  /** The hostname of a managed machine; when a directory-only device was last seen. */
  detail?: string | null;
  os?: string | null;
  customers?: { name: string; imageUrl?: string }[];
  /** The device page — managed machines only: a directory-only device has none. */
  href?: string | null;
}

const toCustomers = (customers: DeviceCustomers) =>
  customers.map(customer => ({
    name: customer.name,
    imageUrl: getFullImageUrl(customer.image?.imageUrl, customer.image?.hash),
  }));

function lastSeen(lastSeenAt: string | null | undefined): string | null {
  const at = lastSeenAt ? new Date(lastSeenAt) : null;
  return at && !Number.isNaN(at.getTime())
    ? `Last Online: ${formatDistanceToNowStrict(at, { addSuffix: true })}`
    : null;
}

function toManagedRows(devices: Devices): DeviceRow[] {
  return devices.managed.flatMap(({ machine, directoryDevice }) =>
    machine
      ? [
          {
            id: directoryDevice.id,
            name: machine.displayName ?? machine.hostname ?? machine.machineId,
            detail: machine.hostname,
            os: directoryDevice.operatingSystem,
            customers: toCustomers(directoryDevice.customers),
            href: routes.devices.details(machine.machineId),
          },
        ]
      : [],
  );
}

function toUnmanagedRows(devices: Devices): DeviceRow[] {
  return devices.unmanaged.map(({ directoryDevice }) => ({
    id: directoryDevice.id,
    name: directoryDevice.displayName,
    detail: lastSeen(directoryDevice.lastSeenAt),
    os: directoryDevice.operatingSystem,
    customers: toCustomers(directoryDevice.customers),
    href: null,
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

function CustomerCell({ row }: { row: DeviceRow }) {
  const loading = useLoadingScope();
  const customers = row.customers ?? [];
  const { first, more } = firstAndCount(customers.map(customer => customer.name));
  const firstCustomer = customers[0];
  // The customer's logo beside its name (Figma 1014:1709), the devices table's customer cell.
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      {(loading || firstCustomer) && (
        <EntityImage src={firstCustomer?.imageUrl} alt={firstCustomer?.name ?? ''} sizeClassName="size-12" />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)]">
        <TruncateText loading={loading}>{first}</TruncateText>
        {more > 0 && <span className="shrink-0 text-ods-text-secondary text-h4">+{more}</span>}
      </div>
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
  {
    id: DEVICE_COLUMNS.customer.id,
    header: DEVICE_COLUMNS.customer.header,
    cell: ({ row }: { row: Row<DeviceRow> }) => <CustomerCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(DEVICE_COLUMNS.customer),
  },
  {
    id: DEVICE_COLUMNS.open.id,
    cell: ({ row }: { row: Row<DeviceRow> }) => {
      const { href, name } = row.original;
      if (!href) return null;
      return <OpenRowButton label={`Open ${name ?? 'device'} in new tab`} onClick={openInNewTab(href)} />;
    },
    enableSorting: false,
    meta: liveColumnMeta(DEVICE_COLUMNS.open),
  },
];

const getRowId = (row: DeviceRow) => row.id;
const rowHref = (row: DeviceRow) => row.href ?? null;
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
        rowHref={rowHref}
        emptyState={oneLineEmptyState('No devices.')}
      />
    </section>
  );
}

const MANAGED = 'Managed by OpenFrame';
const NOT_MANAGED = 'Not managed by OpenFrame';

/**
 * The heading and the two sections (contract §2, D5): agent machines, then the devices only the directory knows. A
 * section with nothing in it is left out; with no device at all, one line says so.
 */
function DevicesSections({ devices }: { devices: Devices | null }) {
  const managed = devices ? toManagedRows(devices) : [];
  const unmanaged = devices ? toUnmanagedRows(devices) : null;
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
