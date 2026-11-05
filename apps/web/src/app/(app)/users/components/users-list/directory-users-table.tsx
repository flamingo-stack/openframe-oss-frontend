'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  type DataTableFilterOption,
  type FilterGroup,
  FilterModal,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  directoryUsersTable_query$data,
  directoryUsersTable_query$key,
} from '@/__generated__/directoryUsersTable_query.graphql';
import type { directoryUsersTablePaginationQuery as DirectoryUsersTablePaginationQueryType } from '@/__generated__/directoryUsersTablePaginationQuery.graphql';
import type {
  DirectoryUserFilterInput,
  directoryUsersTableQuery as DirectoryUsersTableQueryType,
} from '@/__generated__/directoryUsersTableQuery.graphql';
import {
  EmptyState,
  type InfiniteScroll,
  liveColumnMeta,
  NO_ITEMS,
  NO_NEXT_PAGE,
  oneLineEmptyState,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { DirectoryReadability, TopAdminState } from '@/generated/schema-enums';
import { toClaimingCustomer } from '@/graphql/directory/customer-claim-fields';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { multiColumnFilter } from '../../../software/components/shared/column-filters';
import {
  lastSignInLabel,
  providerMarks,
  topAdminRole,
  userStatusTag,
  userStatusTooltip,
} from '../../utils/user-presentation';
import { type UserFilterOptions, useUserFilters } from './use-user-filters';
import { CustomerCell, FirstPlusCountCell, StatusCell, UserCell, type UserRow } from './user-row-cells';
import { CUSTOMER_USER_COLUMNS, USER_COLUMNS, USERS_PAGE_SIZE } from './users-columns';
import type { UserSelections } from './users-filter';

/**
 * One row per person (contract §1): without a customer, every user of every connected tenant; with one, the people
 * that customer's rules claim.
 */
const directoryUsersTableQuery = graphql`
  query directoryUsersTableQuery(
    $organizationId: ID
    $filter: DirectoryUserFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    ...directoryUsersTable_query
      @arguments(organizationId: $organizationId, filter: $filter, search: $search, first: $first, after: $after)
  }
`;

// Stored values only: `details` is a live provider read and belongs to the user page, never to a list.
const directoryUsersTableFragment = graphql`
  fragment directoryUsersTable_query on Query
  @refetchable(queryName: "directoryUsersTablePaginationQuery")
  @argumentDefinitions(
    organizationId: { type: "ID" }
    filter: { type: "DirectoryUserFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryUsers(organizationId: $organizationId, filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "directoryUsersTable_directoryUsers") {
      totalCount
      edges {
        node {
          personKey
          displayName
          email
          providers
          status
          topAdmin
          lastSignInAt
          licenses {
            name
          }
          customers {
            ...customerClaimFields_claim
          }
          accounts {
            id
            signInName
            source
            status
            statusReason
            statusDetail
            topAdmin
            signInData
            connection {
              name
              provider
            }
            devices {
              managed {
                machine {
                  displayName
                  hostname
                }
                directoryDevice {
                  displayName
                }
              }
              unmanaged {
                directoryDevice {
                  displayName
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type PersonNode = directoryUsersTable_query$data['directoryUsers']['edges'][number]['node'];

/**
 * The row as its cells read it. Per-account values come from the account that explains the person's merged value: the
 * one whose status is the row's status, the one holding the top admin role, the first one whose sign-in is unreadable.
 */
function toUserRow(node: PersonNode): UserRow {
  const [firstAccount] = node.accounts;
  const statusAccount = node.accounts.find(account => account.status === node.status) ?? firstAccount;
  const adminAccount = node.accounts.find(account => account.topAdmin === TopAdminState.YES);
  const signInData =
    node.accounts.find(account => account.signInData !== DirectoryReadability.READ)?.signInData ??
    DirectoryReadability.READ;
  return {
    id: node.personKey,
    href: firstAccount ? routes.users.details(firstAccount.id) : null,
    name: node.displayName,
    // A person whose accounts hold no mailbox is named by the sign-in name of the first account that has one.
    email: node.email ?? node.accounts.find(account => account.signInName)?.signInName ?? null,
    providers: node.providers.flatMap(providerMarks),
    roleTag: adminAccount ? topAdminRole(node.topAdmin, adminAccount.source) : null,
    customers: node.customers.map(toClaimingCustomer),
    tenant: firstAccount?.connection
      ? { name: firstAccount.connection.name, provider: firstAccount.connection.provider }
      : null,
    devices: node.accounts.flatMap(({ devices: { managed, unmanaged } }) => [
      ...managed.map(
        ({ machine, directoryDevice }) => machine?.displayName || machine?.hostname || directoryDevice.displayName,
      ),
      ...unmanaged.map(({ directoryDevice }) => directoryDevice.displayName),
    ]),
    status: userStatusTag(node.status),
    statusTooltip: statusAccount ? userStatusTooltip(statusAccount.statusReason, statusAccount.statusDetail) : null,
    lastSignIn: lastSignInLabel(node.lastSignInAt, signInData, 'relative'),
    licenses: node.licenses.map(license => license.name),
  };
}

/**
 * The columns. The global page (Figma 733:99047) names the customer and narrows by it; a customer's Users tab
 * (733:98943) is already one customer, so it shows the licences instead and narrows by them.
 */
function buildColumns(options: UserFilterOptions, customerScoped: boolean): ColumnDef<UserRow>[] {
  const layout = customerScoped ? CUSTOMER_USER_COLUMNS : USER_COLUMNS;
  return [
    {
      id: layout.user.id,
      header: layout.user.header,
      cell: ({ row }: { row: Row<UserRow> }) => <UserCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(layout.user),
    },
    ...(customerScoped
      ? []
      : [
          {
            id: USER_COLUMNS.customer.id,
            header: USER_COLUMNS.customer.header,
            cell: ({ row }: { row: Row<UserRow> }) => <CustomerCell row={row.original} />,
            enableSorting: false,
            filterFn: multiSelectFilterFn,
            meta: liveColumnMeta(USER_COLUMNS.customer, { filter: { options: options.customers } }),
          },
        ]),
    {
      id: layout.devices.id,
      header: layout.devices.header,
      cell: ({ row }: { row: Row<UserRow> }) => <FirstPlusCountCell names={row.original.devices} />,
      enableSorting: false,
      meta: liveColumnMeta(layout.devices),
    },
    {
      id: layout.status.id,
      header: layout.status.header,
      cell: ({ row }: { row: Row<UserRow> }) => <StatusCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(layout.status, { filter: { options: options.statuses } }),
    },
    ...(customerScoped
      ? [
          {
            id: CUSTOMER_USER_COLUMNS.license.id,
            header: CUSTOMER_USER_COLUMNS.license.header,
            cell: ({ row }: { row: Row<UserRow> }) => <FirstPlusCountCell names={row.original.licenses} />,
            enableSorting: false,
            filterFn: multiSelectFilterFn,
            meta: liveColumnMeta(CUSTOMER_USER_COLUMNS.license, { filter: { options: options.licenses } }),
          },
        ]
      : []),
    {
      id: layout.open.id,
      cell: ({ row }: { row: Row<UserRow> }) => {
        const { href, name } = row.original;
        if (!href) return null;
        return <OpenRowButton label={`Open ${name ?? 'user'} in new tab`} onClick={openInNewTab(href)} />;
      },
      enableSorting: false,
      meta: liveColumnMeta(layout.open),
    },
  ];
}

/** The phone's filter window (Figma 907:31981): the funnels the column headers carry from `content-md` up. */
function filterGroups(options: UserFilterOptions, customerScoped: boolean): FilterGroup[] {
  const group = (id: string, title: string, groupOptions: DataTableFilterOption[]): FilterGroup => ({
    id,
    title,
    options: groupOptions,
  });
  return customerScoped
    ? [
        group(USER_COLUMNS.status.id, USER_COLUMNS.status.header, options.statuses),
        group(CUSTOMER_USER_COLUMNS.license.id, CUSTOMER_USER_COLUMNS.license.header, options.licenses),
      ]
    : [
        group(USER_COLUMNS.customer.id, USER_COLUMNS.customer.header, options.customers),
        group(USER_COLUMNS.status.id, USER_COLUMNS.status.header, options.statuses),
      ];
}

const getRowId = (row: UserRow) => row.id;
const rowHref = (row: UserRow) => row.href ?? null;

interface DirectoryUsersTableProps {
  /** The customer whose users these are (its Users tab); absent on the global Users page. */
  organizationId?: string;
  /** Deferred funnel selection — feeds the queries (lags the live funnels during a refetch). */
  backendFilters: DirectoryUserFilterInput | null;
  debouncedSearch: string;
  /** Live funnel selection — what the headers draw as ticked, so a tick lands instantly. */
  selections: UserSelections;
  onSelectionsChange: (next: UserSelections) => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** No user at all (not a search or funnel miss) — the view drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The phone's filter window is open (its button sits in the view's toolbar). */
  filtersOpen: boolean;
  onFiltersClose: () => void;
}

const UNREAD_FILTER_OPTIONS: UserFilterOptions = { customers: [], statuses: [], licenses: [] };

/** The Users rows, with their own boundary; in its scope the reader draws placeholder rows and does not fetch. */
export function DirectoryUsersTable(props: DirectoryUsersTableProps) {
  return (
    <LoadingSuspense label="Loading users">
      <DirectoryUsersTableReader {...props} />
    </LoadingSuspense>
  );
}

function DirectoryUsersTableReader(props: DirectoryUsersTableProps) {
  if (useLoadingScope()) {
    return (
      <UsersRows
        {...props}
        rows={NO_ITEMS}
        totalCount={0}
        filterOptions={UNREAD_FILTER_OPTIONS}
        infiniteScroll={NO_NEXT_PAGE}
      />
    );
  }
  return <DirectoryUsersTableQuery {...props} />;
}

function DirectoryUsersTableQuery(props: DirectoryUsersTableProps) {
  const { organizationId, backendFilters, debouncedSearch, selections } = props;
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<DirectoryUsersTableQueryType>(
    directoryUsersTableQuery,
    {
      organizationId: organizationId ?? null,
      filter: backendFilters,
      search: debouncedSearch || null,
      first: USERS_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    DirectoryUsersTablePaginationQueryType,
    directoryUsersTable_query$key
  >(directoryUsersTableFragment, queryData);

  const { edges, totalCount } = data.directoryUsers;
  const rows = useMemo(() => edges.map(edge => toUserRow(edge.node)), [edges]);
  const filterOptions = useUserFilters(organizationId, debouncedSearch, backendFilters, selections);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(USERS_PAGE_SIZE);
  };

  return (
    <UsersRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      filterOptions={filterOptions}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

interface UsersRowsProps extends DirectoryUsersTableProps {
  rows: readonly UserRow[];
  totalCount: number;
  filterOptions: UserFilterOptions;
  infiniteScroll: InfiniteScroll;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function UsersRows({
  rows,
  totalCount,
  filterOptions,
  infiniteScroll,
  organizationId,
  backendFilters,
  debouncedSearch,
  selections,
  onSelectionsChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  filtersOpen,
  onFiltersClose,
}: UsersRowsProps) {
  const loading = useLoadingScope();
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);
  const placeholderRows = useMemo(() => (loading ? loadingPlaceholderRows<UserRow>(USERS_PAGE_SIZE) : null), [loading]);

  const table = useDataTable<UserRow>({
    data: placeholderRows ?? (rows as UserRow[]),
    columns: buildColumns(filterOptions, !!organizationId),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table; no user at all gets the page's empty state.
  const showEmptyState = !loading && !debouncedSearch && !backendFilters && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<UsersIcon />}
        title="No users yet"
        description={
          organizationId
            ? // Figma 733:98943's empty frame.
              'This customer’s users will appear here.'
            : 'Users of your connected Microsoft 365 and Google Workspace tenants will be listed here.'
        }
      />
    );
  }

  return (
    <>
      <LiveTable
        table={table}
        pageSize={USERS_PAGE_SIZE}
        loadingCells={loading}
        stickyHeaderOffset={stickyHeaderOffset}
        itemName="result"
        totalCount={totalCount}
        isPending={isPending}
        emptyState={oneLineEmptyState(
          debouncedSearch
            ? `No users found matching "${debouncedSearch}". Try adjusting your search.`
            : 'No users match the selected filters. Try adjusting your filters.',
        )}
        rowHref={rowHref}
        footer={rows.length > 0 ? infiniteScroll : null}
      />
      <FilterModal
        isOpen={filtersOpen}
        onClose={onFiltersClose}
        filterGroups={filterGroups(filterOptions, !!organizationId)}
        currentFilters={{ ...selections }}
        onFilterChange={filters =>
          onSelectionsChange({
            customer: filters.customer ?? [],
            status: filters.status ?? [],
            license: filters.license ?? [],
          })
        }
      />
    </>
  );
}
