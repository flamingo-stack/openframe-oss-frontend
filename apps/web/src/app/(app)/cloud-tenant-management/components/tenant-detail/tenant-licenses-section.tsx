'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter02Icon, InfoCircleIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type DataTableSettings,
  FilterModal,
  Input,
  LoadingWhen,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  DirectoryLicenseOrderInput,
  tenantLicensesSectionQuery as TenantLicensesSectionQueryType,
} from '@/__generated__/tenantLicensesSectionQuery.graphql';
import { NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { DirectoryLicenseSortField, DirectoryProvider, SortDirection } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { TenantNotice } from './tenant-notice';

// Its own query: search and sort ask the server again, and the page's record should not wait for them. The snapshot of
// the last read, no provider call.
const tenantLicensesSectionQuery = graphql`
  query tenantLicensesSectionQuery($id: ID!, $search: String, $orderBy: DirectoryLicenseOrderInput) {
    directoryConnection(connectionId: $id) {
      licenseSummary {
        assigned
      }
      licenses(search: $search, orderBy: $orderBy) {
        id
        name
        assigned
        purchased
        unused
        free
      }
    }
  }
`;

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface LicenseRow {
  id: string;
  name?: string;
  free?: boolean;
  assigned?: string;
  unused?: number | null;
}

const LICENSE_COLUMNS = {
  license: { id: 'license', header: 'Licence', width: 'flex-1 min-w-0' },
  // A phone keeps the licence and what is assigned, the label under the number (Figma 3126-13528).
  assigned: { id: 'assigned', header: 'Assigned', width: 'w-24 shrink-0 content-md:w-48', sortable: true },
  unused: { id: 'unused', header: 'Unused', width: 'w-44 shrink-0', hideAt: 'md', sortable: true },
} satisfies Record<string, TableSkeletonColumn>;

const LICENSES_SKELETON_ROWS = 3;

const SORT_FIELDS = {
  [LICENSE_COLUMNS.assigned.id]: DirectoryLicenseSortField.ASSIGNED,
  [LICENSE_COLUMNS.unused.id]: DirectoryLicenseSortField.UNUSED,
};

type LicenseSort = { id: string; desc: boolean };

/** The phone's sort window carries the sorted column as its one filter (see its `onFilterChange`). */
const SORT_FILTER = 'sort';

function toOrderBy(sort: LicenseSort | null): DirectoryLicenseOrderInput | null {
  if (!sort) return null;
  return { field: SORT_FIELDS[sort.id], direction: sort.desc ? SortDirection.DESC : SortDirection.ASC };
}

function LicenseCell({ row }: { row: LicenseRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
      <TruncateText loading={loading}>{row.name ?? ''}</TruncateText>
      {row.free && <Tag data-loading-optional as="span" variant="grey" label="Free" className="shrink-0" />}
    </div>
  );
}

function AssignedCell({ row }: { row: LicenseRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText loading={loading}>{row.assigned ?? ''}</TruncateText>
      <span className="text-ods-text-secondary text-h6 content-md:hidden">Assigned</span>
    </div>
  );
}

/** LICENCE in the grid layout: the name and its "Free" tag on the row's one line. */
function LicenseGridCell({ row }: { row: LicenseRow }) {
  return (
    <DataTable.Cell
      text={row.name ?? ''}
      tag={row.free ? <Tag data-loading-optional as="span" variant="grey" label="Free" /> : undefined}
    />
  );
}

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order,
 * resized widths) kept in the browser under this table's own key.
 */
const LICENSES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'tenant-licences' };

/**
 * The columns. Each states what the grid layout reads beside the card layout's `meta.width`: a `size`, a one-line
 * `gridCell` where the card cell is not one line already, and a `label` for the settings menu.
 */
function licenseColumns(showUnused: boolean): ColumnDef<LicenseRow>[] {
  return [
    {
      id: LICENSE_COLUMNS.license.id,
      header: LICENSE_COLUMNS.license.header,
      cell: ({ row }: { row: Row<LicenseRow> }) => <LicenseCell row={row.original} />,
      enableSorting: false,
      size: 360,
      meta: liveColumnMeta(LICENSE_COLUMNS.license, {
        label: 'Licence',
        gridCell: ({ row }: { row: Row<LicenseRow> }) => <LicenseGridCell row={row.original} />,
      }),
    },
    {
      id: LICENSE_COLUMNS.assigned.id,
      header: LICENSE_COLUMNS.assigned.header,
      cell: ({ row }: { row: Row<LicenseRow> }) => <AssignedCell row={row.original} />,
      enableSorting: false,
      size: 200,
      meta: liveColumnMeta(LICENSE_COLUMNS.assigned, {
        label: 'Assigned',
        // The card cell says "Assigned" under the number on a phone, where it has no header; the grid always has one.
        gridCell: ({ row }: { row: Row<LicenseRow> }) => <DataTable.Cell text={row.original.assigned ?? ''} />,
      }),
    },
    ...(showUnused
      ? [
          {
            id: LICENSE_COLUMNS.unused.id,
            header: LICENSE_COLUMNS.unused.header,
            cell: ({ row }: { row: Row<LicenseRow> }) => (
              <TruncateText loading={row.original.assigned === undefined}>
                {row.original.unused == null ? EMPTY_VALUE : String(row.original.unused)}
              </TruncateText>
            ),
            enableSorting: false,
            size: 180,
            meta: liveColumnMeta(LICENSE_COLUMNS.unused, { label: 'Unused' }),
          },
        ]
      : []),
  ];
}

const getRowId = (row: LicenseRow) => row.id;

interface LicensesTableProps {
  id: string;
  /** The provider reports purchased seats: the Unused column, and "of N". */
  showUnused: boolean;
  /** Deferred sort and search: they feed the query. */
  orderBy: DirectoryLicenseOrderInput | null;
  search: string;
  /** Live sort: what the header draws, so a click lands instantly. */
  sort: LicenseSort | null;
  onSortChange: (columnId: string) => void;
  isPending: boolean;
}

function LicensesRows({
  rows,
  notRead,
  showUnused,
  search,
  sort,
  onSortChange,
  isPending,
}: LicensesTableProps & { rows: readonly LicenseRow[]; notRead: boolean }) {
  const loading = useLoadingScope();
  // The grid table, behind the app's one table flag; card rows while it is off. Both of the section's branches (its
  // loading scope and the read rows) draw this table, so both draw the same layout.
  const layout = tableLayoutFor(useTableGridGate());
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<LicenseRow>(LICENSES_SKELETON_ROWS) : null),
    [loading],
  );
  const columns = useMemo(() => licenseColumns(showUnused), [showUnused]);
  const table = useDataTable<LicenseRow>({
    data: placeholderRows ?? (rows as LicenseRow[]),
    columns,
    getRowId,
    enableSorting: false,
  });
  const empty = search
    ? `No licences found matching "${search}". Try adjusting your search.`
    : notRead
      ? 'The licences have not been read yet.'
      : 'This directory holds no licences.';
  return (
    <LiveTable
      table={table}
      skeletonRows={LICENSES_SKELETON_ROWS}
      loadingCells={loading}
      stickyHeader={false}
      // A section of the tenant's page: the grid keeps its natural height and the page scrolls. Card rows do not read
      // the settings.
      layout={layout}
      settings={LICENSES_TABLE_SETTINGS}
      itemName="result"
      totalCount={rows.length}
      isPending={isPending}
      sort={sort}
      onSortChange={onSortChange}
      emptyState={oneLineEmptyState(empty)}
    />
  );
}

/**
 * The rows, with their own boundary: the search above them stays live while they are read. Until the app's table flag
 * is answered the rows are a loading scope, so one layout is never drawn and then replaced by the other.
 */
function LicensesTable(props: LicensesTableProps) {
  const tableGate = useTableGridGate();
  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <LoadingSuspense label="Loading licences">
        <LicensesTableReader {...props} />
      </LoadingSuspense>
    </LoadingWhen>
  );
}

function LicensesTableReader(props: LicensesTableProps) {
  if (useLoadingScope()) return <LicensesRows {...props} rows={NO_ITEMS} notRead={false} />;
  return <LicensesTableQuery {...props} />;
}

function LicensesTableQuery(props: LicensesTableProps) {
  const { id, search, orderBy } = props;
  const retryKey = useRetryKey();
  const { directoryConnection } = useLazyLoadQuery<TenantLicensesSectionQueryType>(
    tenantLicensesSectionQuery,
    { id, search: search || null, orderBy },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const licenses = directoryConnection?.licenses;
  const rows = useMemo<LicenseRow[]>(
    () =>
      (licenses ?? []).map(license => ({
        id: license.id,
        name: license.name,
        free: license.free,
        assigned: license.purchased == null ? String(license.assigned) : `${license.assigned} of ${license.purchased}`,
        unused: license.unused,
      })),
    [licenses],
  );
  // The page above has already said "not found" for a missing record.
  if (!directoryConnection) return null;
  return <LicensesRows {...props} rows={rows} notRead={directoryConnection.licenseSummary == null} />;
}

/**
 * "Licences" (Figma 3051-7925, Google 3065-17490 and 3126-13528): per SKU, searched and sorted by the server. Google
 * reports assignments only, so it says so and draws no Unused column.
 */
export function TenantLicensesSection({ id, provider }: { id: string; provider: string | null }) {
  const loading = useLoadingScope();
  const layout = tableLayoutFor(useTableGridGate());
  const [input, setInput] = useState('');
  const search = useDebounce(input, 300).trim();
  const [sort, setSort] = useState<LicenseSort | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const orderBy = useMemo(() => toOrderBy(sort), [sort]);
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(orderBy, search);
  const noTotals = provider === DirectoryProvider.GOOGLE_WORKSPACE;

  // Ascending, descending, then back to the order by name.
  const handleSortChange = (columnId: string) => {
    setSort(current => {
      if (current?.id !== columnId) return { id: columnId, desc: false };
      return current.desc ? null : { id: columnId, desc: true };
    });
  };

  return (
    <section className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Licences</h2>
      {noTotals && (
        <TenantNotice data-loading-optional icon={<InfoCircleIcon size={24} />} title="Purchased total not available" />
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-[var(--spacing-system-m)]">
          <Input
            userValue
            placeholder="Search for Licence"
            value={input}
            onChange={event => setInput(event.target.value)}
            disabled={loading}
            aria-label="Search for Licence"
            className="flex-1"
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
          />
          {/* Card rows: the header sorts from `content-md`; a phone has no header (Figma 3126-13528). The grid table
              has its header, with the sort, at every width. */}
          {layout === 'cards' && (
            <Button
              variant="outline"
              size="icon"
              className="content-md:hidden"
              onClick={() => setSortOpen(true)}
              disabled={loading}
              aria-label="Sort licences"
              leftIcon={<Filter02Icon className="text-ods-text-primary" />}
            />
          )}
        </div>
        <LicensesTable
          id={id}
          showUnused={!noTotals}
          orderBy={deferredFilters}
          search={deferredSearch}
          sort={sort}
          onSortChange={handleSortChange}
          isPending={isPending}
        />
      </div>
      <FilterModal
        isOpen={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort"
        filterGroups={[]}
        // FilterModal's Reset reaches only `onFilterChange`, which Apply calls too: Reset with no filters, Apply with the
        // window's current ones. The sort rides as the window's one filter, so Reset clears it and Apply keeps it.
        currentFilters={sort ? { [SORT_FILTER]: [sort.id] } : {}}
        onFilterChange={filters => {
          if (!filters[SORT_FILTER]) setSort(null);
        }}
        sortConfig={{
          columns: noTotals
            ? [{ key: LICENSE_COLUMNS.assigned.id, label: LICENSE_COLUMNS.assigned.header }]
            : [
                { key: LICENSE_COLUMNS.assigned.id, label: LICENSE_COLUMNS.assigned.header },
                { key: LICENSE_COLUMNS.unused.id, label: LICENSE_COLUMNS.unused.header },
              ],
          sortBy: sort?.id,
          sortDirection: sort?.desc ? 'desc' : 'asc',
        }}
        onSort={(columnId, direction) => setSort({ id: columnId, desc: direction === 'desc' })}
        onSortClear={() => setSort(null)}
      />
    </section>
  );
}
