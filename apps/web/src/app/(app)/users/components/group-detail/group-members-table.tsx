'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  FilterModal,
  InfoHint,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  groupMembersTable_query$data,
  groupMembersTable_query$key,
} from '@/__generated__/groupMembersTable_query.graphql';
import type { groupMembersTablePaginationQuery as GroupMembersTablePaginationQueryType } from '@/__generated__/groupMembersTablePaginationQuery.graphql';
import type { groupMembersTableQuery as GroupMembersTableQueryType } from '@/__generated__/groupMembersTableQuery.graphql';
import {
  type InfiniteScroll,
  liveColumnMeta,
  NO_ITEMS,
  NO_NEXT_PAGE,
  oneLineEmptyState,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { DirectoryMembershipScope } from '@/generated/schema-enums';
import { toAccountRow } from '@/graphql/directory/account-row-fields';
import { toCustomer } from '@/graphql/directory/customer-claim-fields';
import { toCustomerOption } from '@/graphql/directory/customer-option';
import { openInNewTab } from '@/lib/open-in-new-tab';
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
import { MemberCell, MemberCustomerCell, type MemberRow, MemberTypeCell } from './group-member-row';

const MEMBERS_PAGE_SIZE = 20;

const groupMembersTableQuery = graphql`
  query groupMembersTableQuery(
    $id: ID!
    $organizationId: ID
    $scope: DirectoryMembershipScope
    $first: Int!
    $after: String
  ) {
    ...groupMembersTable_query
      @arguments(id: $id, organizationId: $organizationId, scope: $scope, first: $first, after: $after)
  }
`;

// Through the query, not the group: DirectoryGroup is not a Node, so only a fragment on Query can page it. NESTED is a
// live read; members resolve on directoryGroup only, so a list of groups cannot set one off per row.
const groupMembersTableFragment = graphql`
  fragment groupMembersTable_query on Query
  @refetchable(queryName: "groupMembersTablePaginationQuery")
  @argumentDefinitions(
    id: { type: "ID!" }
    organizationId: { type: "ID" }
    scope: { type: "DirectoryMembershipScope" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryGroup(id: $id, organizationId: $organizationId) {
      provider
      members(scope: $scope, first: $first, after: $after) @connection(key: "groupMembersTable_members") {
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
          endCursor
        }
      }
    }
  }
`;

type MemberNode = NonNullable<groupMembersTable_query$data['directoryGroup']>['members']['edges'][number]['node'];

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

const COLUMNS: ColumnDef<MemberRow>[] = [
  {
    id: MEMBER_COLUMNS.member.id,
    header: MEMBER_COLUMNS.member.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <MemberCell row={row.original} />,
    enableSorting: false,
    filterFn: multiSelectFilterFn,
    meta: liveColumnMeta(MEMBER_COLUMNS.member, { filter: { options: SCOPE_OPTIONS } }),
  },
  {
    id: MEMBER_COLUMNS.type.id,
    header: MEMBER_COLUMNS.type.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <MemberTypeCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(MEMBER_COLUMNS.type),
  },
  {
    id: MEMBER_COLUMNS.customer.id,
    header: MEMBER_COLUMNS.customer.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <MemberCustomerCell row={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(MEMBER_COLUMNS.customer),
  },
  {
    id: MEMBER_COLUMNS.licences.id,
    header: MEMBER_COLUMNS.licences.header,
    cell: ({ row }: { row: Row<MemberRow> }) => <FirstPlusCountCell names={row.original.licenses} />,
    enableSorting: false,
    meta: liveColumnMeta(MEMBER_COLUMNS.licences),
  },
  {
    id: MEMBER_COLUMNS.open.id,
    cell: ({ row }: { row: Row<MemberRow> }) => {
      const { href, name } = row.original;
      if (!href) return null;
      return <OpenRowButton label={`Open ${name ?? 'member'} in new tab`} onClick={openInNewTab(href)} />;
    },
    enableSorting: false,
    meta: liveColumnMeta(MEMBER_COLUMNS.open),
  },
];

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
}

/**
 * The Members section (Figma 733:99325): the heading and the table. Direct members by default; Nested is a live read.
 * The frame's search and its Member type, Customer and Licences funnels have nothing to ask: `members` takes a scope only.
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
  const { params, setParam } = useApiParams({
    scope: { type: 'string', default: DirectoryMembershipScope.DIRECT },
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const liveScope = params.scope === DirectoryMembershipScope.NESTED ? params.scope : DirectoryMembershipScope.DIRECT;
  const { deferredFilters: scope, isPending } = useDeferredQuery<DirectoryMembershipScope>(liveScope, '');
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

/** The heading and the rows, one island: a missing group has no Members section to head. */
function GroupMembersIsland({ loading = false, ...props }: MembersProps & { loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading members" gated={loading}>
      <GroupMembersReader {...props} />
    </LoadingSuspense>
  );
}

function GroupMembersReader(props: MembersProps) {
  if (useLoadingScope()) {
    return (
      <MembersRows
        {...props}
        rows={NO_ITEMS}
        totalCount={0}
        hiddenCount={0}
        external={null}
        liveFailed={false}
        infiniteScroll={NO_NEXT_PAGE}
      />
    );
  }
  return <GroupMembersQuery {...props} />;
}

function GroupMembersQuery(props: MembersProps) {
  const { id, customerId, scope } = props;
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<GroupMembersTableQueryType>(
    groupMembersTableQuery,
    { id, organizationId: customerId ?? null, scope, first: MEMBERS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    GroupMembersTablePaginationQueryType,
    groupMembersTable_query$key
  >(groupMembersTableFragment, queryData);

  const group = data.directoryGroup;
  const members = group?.members;
  const rows = useMemo(
    () =>
      (members?.edges ?? []).flatMap(edge => {
        const row = toMemberRow(edge.node, customerId);
        return row ? [row] : [];
      }),
    [members, customerId],
  );
  // A missing group is the title's to say ("Group not found").
  if (!group || !members) return null;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(MEMBERS_PAGE_SIZE);
  };
  return (
    <MembersRows
      {...props}
      rows={rows}
      totalCount={members.totalCount}
      hiddenCount={members.hiddenMemberCount}
      external={{ count: members.externalMemberCount, provider: group.provider }}
      liveFailed={members.liveDataUnavailable}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

function MembersRows({
  rows,
  totalCount,
  hiddenCount,
  external,
  liveFailed,
  infiniteScroll,
  liveScope,
  onScopeChange,
  isPending,
  heading,
}: MembersProps & {
  rows: readonly MemberRow[];
  totalCount: number;
  hiddenCount: number;
  /** Members the directory does not hold (an outside address, a contact): counted over the whole roster, never listed. */
  external: { count: number; provider: string } | null;
  liveFailed: boolean;
  infiniteScroll: InfiniteScroll;
}) {
  const loading = useLoadingScope();
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
          table={table}
          pageSize={MEMBERS_PAGE_SIZE}
          loadingCells={loading}
          stickyHeader={false}
          itemName="result"
          totalCount={totalCount}
          isPending={isPending}
          emptyState={oneLineEmptyState(membersEmptyMessage({ liveFailed, hiddenCount, externalCount }))}
          rowHref={rowHref}
          footer={rows.length > 0 ? infiniteScroll : null}
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
