'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { DeviceTypeTile, OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  CheckCircleIcon,
  Link01Icon,
  MinusCircleIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, useMemo, useState } from 'react';
import { graphql, readInlineData, useLazyLoadQuery } from 'react-relay';
import type { userDevicesTab_record$key } from '@/__generated__/userDevicesTab_record.graphql';
import type {
  userDevicesTabQuery$data,
  userDevicesTabQuery as UserDevicesTabQueryType,
} from '@/__generated__/userDevicesTabQuery.graphql';
import { liveColumnMeta, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { toCustomer } from '@/graphql/directory/customer-claim-fields';
import { toCustomerOption } from '@/graphql/directory/customer-option';
import { type LinkMachine, toLinkMachine } from '@/graphql/directory/link-machine-fields';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { deviceOrigin, matchedKeysLabel, recordDetail } from '../../utils/device-presentation';
import { CustomerCell, type UserRow } from '../users-list/user-row-cells';
import { LinkDeviceModal, type LinkRecord } from './link-device-modal';
import { UserTabHeading } from './user-tab-heading';

const userDevicesTabRecordFragment = graphql`
  fragment userDevicesTab_record on OrgDevice @inline {
    id
    displayName
    source
    sourceId
    operatingSystem
    lastSeenAt
    linkable
    connection {
      name
      provider
    }
    customers {
      ...customerOption_organization
    }
    suggestions {
      matchedKeys
      machine {
        ...linkMachineFields_machine
      }
    }
  }
`;

/**
 * The selected account's devices (S3), read whole. `managed` holds the agent machines linked to its directory records,
 * `unmanaged` the records no agent runs on (D23).
 */
const userDevicesTabQuery = graphql`
  query userDevicesTabQuery($id: ID!) {
    directoryAccount(id: $id) {
      devices {
        managed {
          machine {
            ...linkMachineFields_machine
          }
          directoryDevice {
            ...userDevicesTab_record
          }
        }
        unmanaged {
          directoryDevice {
            ...userDevicesTab_record
          }
        }
      }
    }
  }
`;

type Devices = NonNullable<userDevicesTabQuery$data['directoryAccount']>['devices'];

const DEVICE_COLUMNS = {
  device: { id: 'device', header: 'Device', width: 'flex-[2] min-w-0' },
  // A phone keeps the device, its status and the open button (Figma 1019:35893).
  status: { id: 'status', header: 'Status', width: 'flex-none content-md:w-48 content-md:shrink-0' },
  os: { id: 'os', header: 'OS', width: 'flex-1 min-w-0', hideAt: 'md' },
  customer: { id: 'customer', header: 'Customer', width: 'flex-[2] min-w-0', hideAt: 'lg' },
  // Figma's "..." holds Update Status, which is not in the contract (F5): its slot carries Link instead.
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none content-md:w-28', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

const SUGGESTED_COLUMNS = {
  device: { id: 'device', header: 'Entra ID Device', width: 'flex-1 min-w-0' },
  match: { id: 'match', header: 'Possible Match', width: 'flex-1 min-w-0', hideAt: 'md' },
  why: { id: 'why', header: 'Why', width: 'flex-1 min-w-0', hideAt: 'md' },
  link: { id: 'link', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface DeviceRow {
  id: string;
  name?: string;
  detail?: string;
  /** The agent machine linked to the record: its row reads MANAGED and opens the device page. */
  machine?: LinkMachine | null;
  os?: string | null;
  customer?: UserRow;
  /** What Link opens with; null when the record cannot carry an agent (D27) or is linked. */
  link?: LinkRecord | null;
}

/** One record with a possible match (D24): the first suggestion is POSSIBLE MATCH, its keys WHY. */
interface SuggestedRow {
  id: string;
  name?: string;
  detail?: string;
  match?: LinkMachine;
  why?: string;
  link?: LinkRecord;
}

function readRecord(ref: userDevicesTab_record$key) {
  const record = readInlineData(userDevicesTabRecordFragment, ref);
  const origin = deviceOrigin(record.source, record.sourceId);
  const suggestions = record.suggestions.map(suggestion => ({
    machine: toLinkMachine(suggestion.machine),
    why: matchedKeysLabel(suggestion.matchedKeys),
  }));
  return {
    id: record.id,
    name: record.displayName,
    detail: recordDetail(origin, record.lastSeenAt),
    os: record.operatingSystem,
    customer: {
      id: record.id,
      customers: record.customers.map(customer => toCustomer(toCustomerOption(customer))),
      tenant: record.connection,
    } satisfies UserRow,
    suggestions,
    link: record.linkable
      ? ({
          id: record.id,
          name: record.displayName,
          origin: origin.name,
          suggestions: suggestions.map(suggestion => suggestion.machine),
        } satisfies LinkRecord)
      : null,
  };
}

/** One table (D23): the machines first, then the records no agent runs on. */
function toDeviceRows({ managed, unmanaged }: Devices): DeviceRow[] {
  return [
    ...managed.map(({ machine, directoryDevice }): DeviceRow => {
      const record = readRecord(directoryDevice);
      const linked = machine ? toLinkMachine(machine) : null;
      return {
        id: record.id,
        // A machine deleted outright reads null until the next match (contract §11.2): the record stands in for it.
        name: linked?.name ?? record.name,
        detail: linked?.hostname ?? record.detail,
        machine: linked,
        os: record.os,
        customer: record.customer,
        link: null,
      };
    }),
    ...unmanaged.map(({ directoryDevice }): DeviceRow => {
      const record = readRecord(directoryDevice);
      return {
        id: record.id,
        name: record.name,
        detail: record.detail,
        machine: null,
        os: record.os,
        customer: record.customer,
        link: record.link,
      };
    }),
  ];
}

function toSuggestedRows({ unmanaged }: Devices): SuggestedRow[] {
  return unmanaged.flatMap(({ directoryDevice }) => {
    const record = readRecord(directoryDevice);
    const [best] = record.suggestions;
    if (!best || !record.link) return [];
    return [
      {
        id: record.id,
        name: record.name,
        detail: record.detail,
        match: best.machine,
        why: best.why,
        link: record.link,
      },
    ];
  });
}

function DeviceCell({ row }: { row: DeviceRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      {row.machine && (
        <span data-loading-optional className="shrink-0">
          <DeviceTypeTile type={row.machine.type} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TruncateText className={loading ? 'w-32' : undefined}>{row.name ?? ''}</TruncateText>
        <TruncateText variant="h6" tone="secondary" className={loading ? 'w-24' : undefined}>
          {row.detail ?? ''}
        </TruncateText>
      </div>
    </div>
  );
}

/** MANAGED or NOT SUPPORTED (Figma 1014:1660). */
function StatusCell({ row }: { row: DeviceRow }) {
  if (row.machine) {
    return <Tag label="Managed" variant="success" icon={<CheckCircleIcon size={16} />} className="w-fit" />;
  }
  return (
    <Tag
      label="Not supported"
      variant="grey"
      icon={<MinusCircleIcon size={16} />}
      loading={row.name === undefined}
      className="w-fit"
    />
  );
}

/** The OS mark and the provider's own OS string (Figma 1014:1707); a string the mark does not know keeps the text. */
function OsCell({ row }: { row: DeviceRow }) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <OSTypeBadge osType={row.os ?? undefined} iconOnly iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      <TruncateText loading={row.os === undefined}>{row.os ?? EMPTY_VALUE}</TruncateText>
    </div>
  );
}

function LinkButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        leftIcon={<Link01Icon className="h-5 w-5" />}
        aria-label={`Link ${name}`}
        className="bg-ods-card"
      />
    </div>
  );
}

/** Link only on a record that can carry an agent; a phone links from Suggested Devices (Figma 1019:35893). */
function ActionsCell({ row, onLink }: { row: DeviceRow; onLink: (record: LinkRecord) => void }) {
  const { link, machine, name } = row;
  return (
    <div className="flex items-center justify-end gap-[var(--spacing-system-xs)]">
      {link && (
        <div data-loading-optional className="hidden content-md:block">
          <LinkButton name={link.name} onClick={() => onLink(link)} />
        </div>
      )}
      <OpenRowButton
        label={`Open ${name ?? 'device'} in new tab`}
        disabled={!machine}
        onClick={machine ? openInNewTab(routes.devices.details(machine.machineId)) : () => undefined}
      />
    </div>
  );
}

const getRowId = (row: { id: string }) => row.id;
const DEVICES_SKELETON_ROWS = 2;
const SUGGESTED_SKELETON_ROWS = 1;

function deviceColumns(onLink: (record: LinkRecord) => void): ColumnDef<DeviceRow>[] {
  return [
    {
      id: DEVICE_COLUMNS.device.id,
      header: DEVICE_COLUMNS.device.header,
      cell: ({ row }: { row: Row<DeviceRow> }) => <DeviceCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(DEVICE_COLUMNS.device),
    },
    {
      id: DEVICE_COLUMNS.status.id,
      header: DEVICE_COLUMNS.status.header,
      cell: ({ row }: { row: Row<DeviceRow> }) => <StatusCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(DEVICE_COLUMNS.status),
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
      cell: ({ row }: { row: Row<DeviceRow> }) => (
        <CustomerCell row={row.original.customer ?? { id: row.original.id }} />
      ),
      enableSorting: false,
      meta: liveColumnMeta(DEVICE_COLUMNS.customer),
    },
    {
      id: DEVICE_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<DeviceRow> }) => <ActionsCell row={row.original} onLink={onLink} />,
      enableSorting: false,
      meta: liveColumnMeta(DEVICE_COLUMNS.actions),
    },
  ];
}

/** The record's name over where it comes from; a phone has no match column, so its second line names the match (1019:35893). */
function SuggestedDeviceCell({ row }: { row: SuggestedRow }) {
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{row.name ?? ''}</TruncateText>
      <div className="min-w-0 content-md:hidden">
        <TruncateText variant="h6" tone="secondary">
          {`May be ${row.match?.name ?? ''}`}
        </TruncateText>
      </div>
      <div className="hidden min-w-0 content-md:block">
        <TruncateText variant="h6" tone="secondary">
          {row.detail ?? ''}
        </TruncateText>
      </div>
    </div>
  );
}

function PossibleMatchCell({ row }: { row: SuggestedRow }) {
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{row.match?.name ?? ''}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        Managed by OpenFrame
      </TruncateText>
    </div>
  );
}

function suggestedColumns(onLink: (record: LinkRecord) => void): ColumnDef<SuggestedRow>[] {
  return [
    {
      id: SUGGESTED_COLUMNS.device.id,
      header: SUGGESTED_COLUMNS.device.header,
      cell: ({ row }: { row: Row<SuggestedRow> }) => <SuggestedDeviceCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(SUGGESTED_COLUMNS.device),
    },
    {
      id: SUGGESTED_COLUMNS.match.id,
      header: SUGGESTED_COLUMNS.match.header,
      cell: ({ row }: { row: Row<SuggestedRow> }) => <PossibleMatchCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(SUGGESTED_COLUMNS.match),
    },
    {
      id: SUGGESTED_COLUMNS.why.id,
      header: SUGGESTED_COLUMNS.why.header,
      cell: ({ row }: { row: Row<SuggestedRow> }) => <TruncateText>{row.original.why ?? ''}</TruncateText>,
      enableSorting: false,
      meta: liveColumnMeta(SUGGESTED_COLUMNS.why),
    },
    {
      id: SUGGESTED_COLUMNS.link.id,
      cell: ({ row }: { row: Row<SuggestedRow> }) => {
        const { link } = row.original;
        return link ? <LinkButton name={link.name} onClick={() => onLink(link)} /> : null;
      },
      enableSorting: false,
      meta: liveColumnMeta(SUGGESTED_COLUMNS.link),
    },
  ];
}

function DevicesTable({ rows, onLink }: { rows: readonly DeviceRow[] | null; onLink: (record: LinkRecord) => void }) {
  const loading = useLoadingScope();
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<DeviceRow>(DEVICES_SKELETON_ROWS) : null),
    [loading],
  );
  const table = useDataTable<DeviceRow>({
    data: placeholderRows ?? ((rows ?? []) as DeviceRow[]),
    columns: deviceColumns(onLink),
    getRowId,
    enableSorting: false,
  });
  return (
    <LiveTable
      table={table}
      skeletonRows={DEVICES_SKELETON_ROWS}
      loadingCells={loading}
      stickyHeader={false}
      itemName="result"
      emptyState={oneLineEmptyState('No devices.')}
    />
  );
}

function SuggestedDevices({ rows, onLink }: { rows: readonly SuggestedRow[]; onLink: (record: LinkRecord) => void }) {
  const table = useDataTable<SuggestedRow>({
    data: rows as SuggestedRow[],
    columns: suggestedColumns(onLink),
    getRowId,
    enableSorting: false,
  });
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xs)]">
      <div className="flex flex-col">
        <UserTabHeading title="Suggested Devices" />
        <p className="text-ods-text-secondary text-h6">
          Records from Entra ID that may be devices already in OpenFrame. Link them one at a time.
        </p>
      </div>
      <LiveTable
        table={table}
        skeletonRows={SUGGESTED_SKELETON_ROWS}
        stickyHeader={false}
        itemName="result"
        emptyState={oneLineEmptyState('No suggestions.')}
      />
    </section>
  );
}

/** The tab (Figma 1014:1660): the devices, then the records that may be one of them. */
function DevicesSections({ devices, onLinked }: { devices: Devices | null; onLinked: () => void }) {
  const [linking, setLinking] = useState<LinkRecord | null>(null);
  const rows = devices ? toDeviceRows(devices) : null;
  const suggested = devices ? toSuggestedRows(devices) : [];
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <UserTabHeading title="Devices" />
        {/* The table's own empty state, as on the other two tabs. */}
        {rows?.length === 0 ? (
          <DataTable.Empty {...oneLineEmptyState('No devices are tied to this user.')} />
        ) : (
          <DevicesTable rows={rows} onLink={setLinking} />
        )}
      </div>
      {suggested.length > 0 && <SuggestedDevices rows={suggested} onLink={setLinking} />}
      {linking && (
        <LinkDeviceModal
          key={linking.id}
          record={linking}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null);
            onLinked();
          }}
        />
      )}
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
  if (useLoadingScope()) return <DevicesSections devices={null} onLinked={() => undefined} />;
  return <UserDevicesQuery id={id} />;
}

function UserDevicesQuery({ id }: { id: string }) {
  const retryKey = useRetryKey();
  // A link moves a record between the lists (contract §5: the UI refetches after a mutation).
  const [links, setLinks] = useState(0);
  const { directoryAccount } = useLazyLoadQuery<UserDevicesTabQueryType>(
    userDevicesTabQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: `${retryKey}:${links}` },
  );
  // A missing account is the header's to say ("User not found").
  if (!directoryAccount) return null;
  return <DevicesSections devices={directoryAccount.devices} onLinked={() => setLinks(count => count + 1)} />;
}
