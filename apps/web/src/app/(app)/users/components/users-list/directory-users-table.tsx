'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
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
import { DirectoryReadability, OrgUserSource, TopAdminState } from '@/generated/schema-enums';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { ruleKindLabel } from '../../../cloud-tenant-management/utils/tenant-presentation';
import { multiColumnFilter } from '../../../software/components/shared/column-filters';
import {
  lastSignInLabel,
  orderClaims,
  topAdminRole,
  userStatusTag,
  userStatusTooltip,
} from '../../utils/user-presentation';
import { type UserFilterOptions, useUserFilters } from './use-user-filters';
import { CustomerCell, DevicesCell, LicensesCell, StatusCell, UserCell, type UserRow } from './user-row-cells';
import { USER_COLUMNS, USERS_PAGE_SIZE } from './users-columns';
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
          serviceAccount
          lastSignInAt
          licenses {
            name
          }
          primaryCustomer {
            organizationId
          }
          customers {
            organization {
              organizationId
              name
              image {
                imageUrl
                hash
              }
            }
            rule {
              kind
            }
            via
          }
          accounts {
            id
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

/** The claim's tooltip line: the rule kind and the value it matched; null for a user added to the customer in OpenFrame. */
function claimLabel(claim: PersonNode['customers'][number]): string | null {
  if (!claim.rule) return null;
  const kind = ruleKindLabel(claim.rule.kind);
  return claim.via ? `${kind}: ${claim.via}` : kind;
}

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
    email: node.email,
    // A mark says which console the account lives in: none for a user added in OpenFrame (brief).
    providers: node.providers.filter(source => source !== OrgUserSource.OPENFRAME),
    roleTag: adminAccount ? topAdminRole(node.topAdmin, adminAccount.source) : null,
    service: node.serviceAccount,
    customers: orderClaims(node.customers, node.primaryCustomer?.organizationId).map(claim => ({
      name: claim.organization.name,
      imageUrl: getFullImageUrl(claim.organization.image?.imageUrl, claim.organization.image?.hash),
      claim: claimLabel(claim),
    })),
    tenant: firstAccount?.connection
      ? { name: firstAccount.connection.name, provider: firstAccount.connection.provider }
      : null,
    devices: node.accounts.flatMap(account => [
      ...account.devices.managed.flatMap(device =>
        device.machine ? [device.machine.displayName ?? device.machine.hostname ?? ''] : [],
      ),
      ...account.devices.unmanaged.map(device => device.directoryDevice.displayName),
    ]),
    status: userStatusTag(node.status),
    statusTooltip: statusAccount ? userStatusTooltip(statusAccount.statusReason, statusAccount.statusDetail) : null,
    lastSignIn: lastSignInLabel(node.lastSignInAt, signInData, 'relative'),
    licenses: node.licenses.map(license => license.name),
  };
}

/**
 * The columns. The global page (Figma 733:99047) names the customer and narrows by tenant; a customer's Users tab
 * (733:98943) is already one customer, so it shows the licences instead and narrows by them.
 */
function buildColumns(options: UserFilterOptions, customerScoped: boolean): ColumnDef<UserRow>[] {
  return [
    {
      id: USER_COLUMNS.user.id,
      header: USER_COLUMNS.user.header,
      cell: ({ row }: { row: Row<UserRow> }) => <UserCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(USER_COLUMNS.user),
    },
    ...(customerScoped
      ? []
      : [
          {
            id: USER_COLUMNS.tenant.id,
            header: USER_COLUMNS.tenant.header,
            cell: ({ row }: { row: Row<UserRow> }) => <CustomerCell row={row.original} />,
            enableSorting: false,
            filterFn: multiSelectFilterFn,
            meta: liveColumnMeta(USER_COLUMNS.tenant, { filter: { options: options.tenants } }),
          },
        ]),
    {
      id: USER_COLUMNS.devices.id,
      header: USER_COLUMNS.devices.header,
      cell: ({ row }: { row: Row<UserRow> }) => <DevicesCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(USER_COLUMNS.devices),
    },
    {
      id: USER_COLUMNS.status.id,
      header: USER_COLUMNS.status.header,
      cell: ({ row }: { row: Row<UserRow> }) => <StatusCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(USER_COLUMNS.status, { filter: { options: options.statuses } }),
    },
    ...(customerScoped
      ? [
          {
            id: USER_COLUMNS.license.id,
            header: USER_COLUMNS.license.header,
            cell: ({ row }: { row: Row<UserRow> }) => <LicensesCell row={row.original} />,
            enableSorting: false,
            filterFn: multiSelectFilterFn,
            meta: liveColumnMeta(USER_COLUMNS.license, { filter: { options: options.licenses } }),
          },
        ]
      : []),
    {
      id: USER_COLUMNS.open.id,
      cell: ({ row }: { row: Row<UserRow> }) => {
        const { href, name } = row.original;
        if (!href) return null;
        return <OpenRowButton label={`Open ${name ?? 'user'} in new tab`} onClick={openInNewTab(href)} />;
      },
      enableSorting: false,
      meta: liveColumnMeta(USER_COLUMNS.open),
    },
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
}

const UNREAD_FILTER_OPTIONS: UserFilterOptions = { tenants: [], statuses: [], licenses: [] };

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
  const { organizationId, backendFilters, debouncedSearch } = props;
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
  const filterOptions = useUserFilters(organizationId, debouncedSearch, backendFilters);

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
  );
}
