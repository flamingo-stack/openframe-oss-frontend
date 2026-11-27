'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  Button,
  type ColumnDef,
  FilterModal,
  GRID_MIN_WIDTH,
  InfoHint,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerFooterProps,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  groupMembersTableQuery$data,
  groupMembersTableQuery as GroupMembersTableQueryType,
} from '@/__generated__/groupMembersTableQuery.graphql';
import { liveColumnMeta, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { openRowColumn } from '@/app/components/shared/open-row-column';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { forwardPage } from '@/app/hooks/forward-page';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { DirectoryMembershipScope } from '@/generated/schema-enums';
import { toAccountRow } from '@/graphql/directory/account-row-fields';
import { toCustomer } from '@/graphql/directory/customer-claim-fields';
import { toCustomerOption } from '@/graphql/directory/customer-option';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { singleColumnFilter } from '../../../software/components/shared/column-filters';
import { deviceOrigin } from '../../utils/device-presentation';
import {
  externalMembersHint,
  membersEmptyMessage,
  nestedGroupLabel,
  pickMembershipScope,
} from '../../utils/group-presentation';
import { topAdminRole } from '../../utils/user-presentation';
import { UserTabHeading } from '../user-detail/user-tab-heading';
import { FirstPlusCountCell } from '../users-list/user-row-cells';
import {
  MemberCell,
  MemberCustomerCell,
  MemberCustomerGridCell,
  MemberGridCell,
  type MemberRow,
  MemberTypeCell,
  MemberTypeGridCell,
} from './group-member-row';

const MEMBERS_PAGE_SIZE = 20;

/**
 * The section's URL prefix: the group page's query string carries the page's own `id` and `customerId`, so the
 * section's scope and pager sit under `members…` (`membersScope`, `membersCursor`, `membersPage`, `membersRefresh`).
 */
const PARAM_PREFIX = 'members';

/**
 * A group's members, one page per request, its cursor in the URL (no `@connection`: a cursor from a link must read
 * exactly its page). `members` pages forward only (`first` / `after`, `PAGED_LISTS.groupMembers`).
 *
 * NESTED is a live read; members resolve on directoryGroup only, so a list of groups cannot set one off per row.
 */
const groupMembersTableQuery = graphql`
  query groupMembersTableQuery(
    $id: ID!
    $organizationId: ID
    $scope: DirectoryMembershipScope
    $first: Int!
    $after: String
  ) {
    directoryGroup(id: $id, organizationId: $organizationId) {
      provider
      members(scope: $scope, first: $first, after: $after) {
        totalCount
        hiddenMemberCount
        externalMemberCount
        liveDataUnavailable
        edges {
          node {
            viaGroup {
              name
            }
            member {
              __typename
              ... on DirectoryAccount {
                ...accountRowFields_account
                source
                topAdmin
                licenses {
                  name
                }
              }
              ... on DirectoryGroup {
                id
                name
                provider
                groupKind: kind
              }
              ... on OrgDevice {
                id
                displayName
                deviceSource: source
                deviceSourceId: sourceId
                deviceCustomers: customers {
                  ...customerOption_organization
                }
                machineLink {
                  machine {
                    machineId
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`;

type MemberNode = NonNullable<groupMembersTableQuery$data['directoryGroup']>['members']['edges'][number]['node'];

/** `customerId`: the customer the page is scoped to, kept when a subgroup opens. A type this build does not know is left out. */
function toMemberRow({ member, viaGroup }: MemberNode, customerId: string | undefined): MemberRow | null {
  const via = viaGroup?.name ?? null;
  switch (member.__typename) {
    case 'DirectoryAccount': {
      const account = toAccountRow(member);
      return {
        ...account,
        id: `${account.id}:${via ?? ''}`,
        kind: 'user',
        roleTag: topAdminRole(member.topAdmin, member.source),
        licenses: member.licenses.map(license => license.name),
        via,
      };
    }
    case 'DirectoryGroup':
      return {
        id: `${member.id}:${via ?? ''}`,
        kind: 'group',
        href: routes.customers.group(member.id, { customerId }),
        name: member.name,
        providers: [member.provider],
        detail: nestedGroupLabel(member.groupKind),
        via,
      };
    case 'OrgDevice':
      // The device page exists only for agent machines: a record no machine is linked to opens nothing.
      return {
        id: `${member.id}:${via ?? ''}`,
        kind: 'device',
        href: member.machineLink ? routes.devices.details(member.machineLink.machine.machineId) : null,
        name: member.displayName,
        detail: deviceOrigin(member.deviceSource, member.deviceSourceId).member,
        customers: member.deviceCustomers.map(customer => toCustomer(toCustomerOption(customer))),
        via,
      };
    default:
      return null;
  }
}

const MEMBER_COLUMNS = {
  // The Members funnel is Figma's Membership block; a phone gets it behind the filter button (900:28413).
  member: { id: 'member', header: 'Members', width: 'flex-[2] min-w-0' },
  // A tablet keeps the member, the customer and the licences (899:80614), a phone the member alone (900:28413).
  type: { id: 'type', header: 'Type', width: 'w-40 shrink-0', hideAt: 'lg' },
  customer: { id: 'customer', header: 'Customer', width: 'flex-1 min-w-0', hideAt: 'md' },
  licences: { id: 'licences', header: 'Licences', width: 'flex-1 min-w-0', hideAt: 'md' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

const SCOPE_OPTIONS = [
  { id: DirectoryMembershipScope.DIRECT, label: 'Direct', value: DirectoryMembershipScope.DIRECT },
  { id: DirectoryMembershipScope.NESTED, label: 'Nested', value: DirectoryMembershipScope.NESTED },
];

/*
 * The columns. Each data column also states what the grid layout reads: a `size` (its designed width), a `label` where
 * the header is not the column's name, and a one-line `gridCell` where the card cell has a second line. The licences
 * are one line already.
 */
const COLUMNS: ColumnDef<MemberRow>[] = [
  {
    id: MEMBER_COLUMNS.member.id,
    header: MEMBER_COLUMNS.member.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <MemberCell row={row.original} />,
    enableSorting: false,
    filterFn: multiSelectFilterFn,
    size: 420,
    minSize: GRID_MIN_WIDTH.media,
    meta: liveColumnMeta(MEMBER_COLUMNS.member, {
      label: 'Member',
      filter: { options: SCOPE_OPTIONS },
      gridCell: ({ row }: { row: Row<MemberRow> }) => <MemberGridCell row={row.original} />,
    }),
  },
  {
    id: MEMBER_COLUMNS.type.id,
    header: MEMBER_COLUMNS.type.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <MemberTypeCell row={row.original} />,
    enableSorting: false,
    size: 220,
    meta: liveColumnMeta(MEMBER_COLUMNS.type, {
      gridCell: ({ row }: { row: Row<MemberRow> }) => <MemberTypeGridCell row={row.original} />,
    }),
  },
  {
    id: MEMBER_COLUMNS.customer.id,
    header: MEMBER_COLUMNS.customer.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <MemberCustomerCell row={row.original} />,
    enableSorting: false,
    size: 260,
    minSize: GRID_MIN_WIDTH.media,
    meta: liveColumnMeta(MEMBER_COLUMNS.customer, {
      gridCell: ({ row }: { row: Row<MemberRow> }) => <MemberCustomerGridCell row={row.original} />,
    }),
  },
  {
    id: MEMBER_COLUMNS.licences.id,
    header: MEMBER_COLUMNS.licences.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <FirstPlusCountCell names={row.original.licenses} />,
    enableSorting: false,
    size: 240,
    meta: liveColumnMeta(MEMBER_COLUMNS.licences),
  },
  // A member with nothing behind it to open (a record no machine is linked to) has no button, in either layout.
  openRowColumn<MemberRow>(MEMBER_COLUMNS.open, row =>
    row.href ? { label: `Open ${row.name ?? 'member'} in new tab`, href: row.href } : null,
  ),
];

/** The whole roster as the server counts it, beside the page's rows. */
interface MembersRoster {
  /** The server's total for the scope, not the rows on the page. */
  totalCount: number;
  /** Members outside the customer the page is scoped to. */
  hiddenCount: number;
  /** Members the directory does not hold (an outside address, a contact): counted over the whole roster, never listed. */
  external: { count: number; provider: string } | null;
  liveFailed: boolean;
}

const UNREAD_ROSTER: MembersRoster = { totalCount: 0, hiddenCount: 0, external: null, liveFailed: false };

const getRowId = (row: MemberRow) => row.id;
const rowHref = (row: MemberRow) => row.href ?? null;

interface MembersProps {
  id: string;
  customerId?: string;
  /** Deferred scope: feeds the query. */
  scope: DirectoryMembershipScope;
  /** Live scope: what the funnel draws as ticked, so a tick lands instantly. */
  liveScope: string;
  onScopeChange: (scope: string) => void;
  isPending: boolean;
  heading: ReactNode;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * The Members section (Figma 733:99325): the heading and the table, one page at a time with First · Prev · Next.
 * Direct members by default; Nested is a live read. The frame's search and its Member type, Customer and Licences
 * funnels have nothing to ask: `members` takes a scope only.
 *
 * The scope and the pager live in the URL under the section's prefix: a scope change drops the cursor in the SAME URL
 * write (one history entry on page 2+, so Back returns to the old view).
 */
export function GroupMembersSection({
  id,
  customerId,
  loading,
}: {
  id: string;
  customerId?: string;
  loading?: boolean;
}) {
  const { params, setParam } = useApiParams(
    { scope: { type: 'string', default: DirectoryMembershipScope.DIRECT } },
    { prefix: PARAM_PREFIX, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  // The safety net for a cursor issued under the other scope. Not the group or the customer: they are the page's.
  const pager = useCursorPager({
    prefix: PARAM_PREFIX,
    pageSize: MEMBERS_PAGE_SIZE,
    ...PAGED_LISTS.groupMembers,
    resetOn: JSON.stringify(params),
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const liveScope = params.scope === DirectoryMembershipScope.NESTED ? params.scope : DirectoryMembershipScope.DIRECT;
  // The scope and the page are deferred together, so `isPending` covers both.
  const {
    deferredFilters: scope,
    deferredPage,
    isPending,
  } = useDeferredQuery<DirectoryMembershipScope, CursorPagerVariables>(liveScope, '', pager.variables);
  const onScopeChange = (next: string) => setParam('scope', next);

  return (
    <>
      <GroupMembersIsland
        id={id}
        customerId={customerId}
        scope={scope}
        liveScope={liveScope}
        onScopeChange={onScopeChange}
        isPending={isPending}
        loading={loading}
        pager={pager}
        pageVariables={deferredPage}
        heading={
          <UserTabHeading
            title="Members"
            actions={
              <Button
                variant="outline"
                size="icon"
                className="content-md:hidden"
                onClick={() => setFiltersOpen(true)}
                disabled={loading}
                aria-label="Open filters"
                leftIcon={<Filter02Icon className="text-ods-text-primary" />}
              />
            }
          />
        }
      />
      <FilterModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filterGroups={[
          {
            id: 'scope',
            title: 'Membership',
            options: SCOPE_OPTIONS,
          },
        ]}
        currentFilters={{ scope: [liveScope] }}
        onFilterChange={filters => onScopeChange(pickMembershipScope(liveScope, filters.scope ?? []))}
      />
    </>
  );
}

/**
 * The heading and the rows, one island: a missing group has no Members section to head. A cursor the server refuses
 * drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
function GroupMembersIsland(props: MembersProps & { loading?: boolean }) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <GroupMembersIslandLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The island's loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function GroupMembersIslandLoading({ loading = false, ...props }: MembersProps & { loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading members" gated={loading}>
      <GroupMembersReader {...props} />
    </LoadingSuspense>
  );
}

function GroupMembersReader(props: MembersProps) {
  if (useLoadingScope()) {
    return <MembersRows {...props} rows={NO_ITEMS} roster={UNREAD_ROSTER} pager={null} />;
  }
  return <GroupMembersQuery {...props} />;
}

/** The page the URL names, its footer and the auto-refresh. */
function GroupMembersQuery({ pager, pageVariables, ...props }: MembersProps) {
  const { id, customerId, scope, isPending } = props;
  const retryKey = useRetryKey();
  const variables: GroupMembersTableQueryType['variables'] = {
    id,
    organizationId: customerId ?? null,
    scope,
    ...forwardPage(pageVariables, MEMBERS_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<GroupMembersTableQueryType>(groupMembersTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<GroupMembersTableQueryType>(groupMembersTableQuery, variables);

  const group = queryData.directoryGroup;
  const members = group?.members;
  const rows = useMemo(
    () =>
      (members?.edges ?? []).flatMap(edge => {
        const row = toMemberRow(edge.node, customerId);
        return row ? [row] : [];
      }),
    [members, customerId],
  );
  const paged = usePagedTable({
    pager,
    pageInfo: members?.pageInfo,
    rowCount: members?.edges.length ?? 0,
    prefix: PARAM_PREFIX,
    refetch,
    isPending,
  });
  // A missing group is the title's to say ("Group not found").
  if (!group || !members) return null;

  return (
    <MembersRows
      {...props}
      rows={rows}
      roster={{
        totalCount: members.totalCount,
        hiddenCount: members.hiddenMemberCount,
        external: { count: members.externalMemberCount, provider: group.provider },
        liveFailed: members.liveDataUnavailable,
      }}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

function MembersRows({
  rows,
  roster: { totalCount, hiddenCount, external, liveFailed },
  pager,
  refresh,
  liveScope,
  onScopeChange,
  isPending,
  heading,
}: Omit<MembersProps, 'pager' | 'pageVariables'> & {
  rows: readonly MemberRow[];
  /** What the server says about the whole roster, beside the page's rows. */
  roster: MembersRoster;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('group-members');
  const externalCount = external?.count ?? 0;
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<MemberRow>(MEMBERS_PAGE_SIZE) : null),
    [loading],
  );
  // Direct is what the list shows with nothing ticked, so the funnel only lights up for Nested.
  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    MEMBER_COLUMNS.member.id,
    liveScope === DirectoryMembershipScope.NESTED ? [liveScope] : [],
    ticked => onScopeChange(pickMembershipScope(liveScope, ticked)),
  );
  const table = useDataTable<MemberRow>({
    data: placeholderRows ?? (rows as MemberRow[]),
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });
  return (
    <section className="flex flex-col gap-[var(--spacing-system-l)]">
      {heading}
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        {hiddenCount > 0 && (
          <p className="text-ods-text-secondary text-h6">
            {`${pluralize(hiddenCount, 'member')} outside this customer`}
          </p>
        )}
        <LiveTable
          {...tableGrid}
          table={table}
          pageSize={MEMBERS_PAGE_SIZE}
          loadingCells={loading}
          stickyHeader={false}
          itemName="result"
          totalCount={totalCount}
          isPending={isPending}
          emptyState={oneLineEmptyState(membersEmptyMessage({ liveFailed, hiddenCount, externalCount }))}
          rowHref={rowHref}
          pager={pager}
          refresh={refresh}
        />
        {external && externalCount > 0 && (
          <p className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-secondary text-h6">
            {pluralize(externalCount, 'external member')}
            <InfoHint label="external members">{externalMembersHint(external.provider)}</InfoHint>
          </p>
        )}
      </div>
    </section>
  );
}
