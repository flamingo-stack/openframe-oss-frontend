'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ArrowRightUpIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  EntityImage,
  Input,
  LoadingWhen,
  type Row,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ComponentProps, useMemo } from 'react';
import type { InfiniteScroll } from '@/app/components/shared';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { formatDateTime } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';
import { useCustomerDeviceCounts } from '../hooks/use-customer-device-counts';
import type { Customer } from '../hooks/use-customers';

export interface UiCustomerEntry {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  deviceCount: number | null;
  numberOfEmployees: number;
  lastActivityDate: string;
  lastActivityRelative: string;
  imageUrl?: string | null;
  imageHash?: string | null;
}

export function CustomerNameCell({ org }: { org: UiCustomerEntry }) {
  // A row still being read has no field: the image, the name and the email line each draw their own loading form.
  const loading = useLoadingScope();
  const fullImageUrl = getFullImageUrl(org.imageUrl, org.imageHash);

  return (
    <div className="flex min-w-0 items-center gap-4">
      <EntityImage src={fullImageUrl} alt={org.name ?? ''} className="size-12 content-md:size-12" />
      <div className="flex min-w-0 flex-col justify-center">
        <TruncateText>{org.name ?? ''}</TruncateText>
        {(org.email || loading) && (
          <TruncateText variant="h6" tone="secondary">
            {org.email ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

export function transformCustomerToEntry(org: Customer, deviceCount: number | null): UiCustomerEntry {
  return {
    id: org.id,
    organizationId: org.organizationId,
    name: org.name,
    email: org.contact.email,
    deviceCount,
    numberOfEmployees: org.numberOfEmployees,
    lastActivityDate: formatDateTime(org.lastActivity),
    lastActivityRelative: formatRelativeTime(org.lastActivity),
    imageUrl: org.imageUrl,
    imageHash: org.imageHash,
  };
}

/** Last Activity sort + date-range filter wiring (desktop/tablet header popover). */
export type CustomersDateFilter = TableDateFilter;

export const buildCustomersColumns = (dateFilter?: CustomersDateFilter): ColumnDef<UiCustomerEntry>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<UiCustomerEntry> }) => <CustomerNameCell org={row.original} />,
    meta: { width: 'flex-1 min-w-0' },
  },
  {
    accessorKey: 'deviceCount',
    header: 'Devices',
    cell: ({ row }: { row: Row<UiCustomerEntry> }) => <CustomerCountsCell org={row.original} />,
    meta: { width: 'w-[200px] shrink-0', hideAt: 'md' },
  },
  {
    accessorKey: 'lastActivityDate',
    // With a date filter wired: label + calendar popover (timestamp sort +
    // range filter), the shared header the execution lists use too.
    header: dateFilter ? () => <DateColumnHeader label="Last Activity" filter={dateFilter} /> : 'Last Activity',
    cell: ({ row }: { row: Row<UiCustomerEntry> }) => (
      <div className="flex min-w-0 flex-col justify-center">
        <TruncateText>{row.original.lastActivityDate ?? ''}</TruncateText>
        <TruncateText variant="h6" tone="secondary">
          {row.original.lastActivityRelative ?? ''}
        </TruncateText>
      </div>
    ),
    // alwaysShowHeader keeps the date filter reachable on tablet (md–lg)
    meta: { width: 'w-[200px] shrink-0', hideAt: 'md', alwaysShowHeader: Boolean(dateFilter) },
  },
  {
    id: 'open',
    cell: ({ row }: { row: Row<UiCustomerEntry> }) => <OpenCustomerButton org={row.original} />,
    enableSorting: false,
    meta: { width: 'w-12 shrink-0 flex-none ml-auto', hideAt: 'md', align: 'right' },
  },
];

/** The customer's devices over its users; two bars while the row is read. */
function CustomerCountsCell({ org }: { org: UiCustomerEntry }) {
  if (useLoadingScope() && org.numberOfEmployees === undefined) {
    return (
      <div className="flex min-w-0 flex-col justify-center">
        <TextLineSkeleton type="h4" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-1/2" />
      </div>
    );
  }
  const { deviceCount, numberOfEmployees } = org;
  const devicesLabel = deviceCount === null ? <EmptyValue /> : pluralize(deviceCount, 'device');
  const usersLabel = pluralize(numberOfEmployees, 'user');
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <span className="truncate text-ods-text-primary text-h4">{devicesLabel}</span>
      <span className="truncate text-ods-text-secondary text-h6">{usersLabel}</span>
    </div>
  );
}

/** Opens the customer's page in a new tab. Static chrome: drawn real while the row is read, and inert. */
function OpenCustomerButton({ org }: { org: UiCustomerEntry }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(routes.customers.details(org.organizationId))}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
        disabled={loading}
      />
    </div>
  );
}

export const customerRowHref = (row: UiCustomerEntry) => routes.customers.details(row.organizationId);

interface CustomersSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CustomersSearchInput({ value, onChange }: CustomersSearchInputProps) {
  return (
    <Input
      userValue
      placeholder="Search for Customer"
      value={value}
      onChange={e => onChange(e.target.value)}
      startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
    />
  );
}

const NO_CUSTOMERS = { title: 'No customers found.' };

type CustomersTableBodyProps = {
  customers: Customer[];
  isLoading?: boolean;
  /** The row the body draws when there is no customer to list. */
  emptyState?: ComponentProps<typeof LiveTable<UiCustomerEntry>>['emptyState'];
  stickyHeaderOffset?: string;
  /** The next page's infinite scroll (a paged list); `null` or omitted draws none. */
  footer?: InfiniteScroll | null;
  /** When set, the Last Activity header hosts the date sort + range popover. */
  dateFilter?: CustomersDateFilter;
} & (
  | {
      /** The list's page size: its loading state (body and infinite footer) draws one full page. */
      pageSize: number;
      skeletonRows?: never;
    }
  | {
      /** The typical row count of a list read whole (no paging). */
      skeletonRows: number;
      pageSize?: never;
    }
);

export function CustomersTableBody({
  customers,
  isLoading = false,
  emptyState = NO_CUSTOMERS,
  stickyHeaderOffset,
  footer,
  dateFilter,
  ...rowCount
}: CustomersTableBodyProps) {
  const orgIds = useMemo(() => customers.map(c => c.organizationId), [customers]);
  const { deviceCounts } = useCustomerDeviceCounts(orgIds);

  const rows = useMemo<UiCustomerEntry[]>(
    () =>
      customers.map(customer =>
        transformCustomerToEntry(
          customer,
          deviceCounts.has(customer.organizationId) ? (deviceCounts.get(customer.organizationId) ?? 0) : null,
        ),
      ),
    [customers, deviceCounts],
  );

  const columns = useMemo(() => buildCustomersColumns(dateFilter), [dateFilter]);

  // While the first page is read the table holds one page of placeholder rows, drawn with the real cells.
  const loadingCount = rowCount.pageSize ?? rowCount.skeletonRows;
  const loadingRows = useMemo(
    () => (isLoading ? loadingPlaceholderRows<UiCustomerEntry>(loadingCount) : null),
    [isLoading, loadingCount],
  );

  const table = useDataTable<UiCustomerEntry>({
    data: loadingRows ?? rows,
    columns,
    getRowId: row => row.id,
    enableSorting: false,
  });

  return (
    // The first page is a client read: the table draws its own loading state in this scope.
    <LoadingWhen loading={isLoading}>
      <LiveTable
        table={table}
        {...rowCount}
        stickyHeader={!!stickyHeaderOffset}
        stickyHeaderOffset={stickyHeaderOffset}
        emptyState={emptyState}
        rowHref={customerRowHref}
        footer={footer}
        loadingCells={isLoading}
      />
    </LoadingWhen>
  );
}
