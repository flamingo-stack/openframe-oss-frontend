'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  lastReadAt,
  type TenantRow,
  type TenantsTableFilters,
  TenantsTableView,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { CodingForkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { tenantsTable_query$key } from '@/__generated__/tenantsTable_query.graphql';
import type { tenantsTablePaginationQuery } from '@/__generated__/tenantsTablePaginationQuery.graphql';
import type {
  DirectoryConnectionFilterInput,
  DirectoryConnectionOrderInput,
  tenantsTableQuery as TenantsTableQueryType,
} from '@/__generated__/tenantsTableQuery.graphql';
import { EmptyState, NO_NEXT_PAGE, useRetryKey, NO_ITEMS } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { isSyncPaused } from '../../utils/tenant-presentation';
import { boundCustomerOptions } from '../tenant-form/bound-customer';

const TENANTS_PAGE_SIZE = 20;

const tenantsTableQuery = graphql`
  query tenantsTableQuery(
    $search: String
    $filter: DirectoryConnectionFilterInput
    $orderBy: DirectoryConnectionOrderInput
    $first: Int!
    $after: String
  ) {
    ...tenantsTable_query @arguments(search: $search, filter: $filter, orderBy: $orderBy, first: $first, after: $after)
  }
`;

// The fields of a row are the core library's `TenantRow`: its cells take plain props, so the
// selection lives here. `access` is a (TTL-cached) provider probe per row; the list is where the
// design shows it.
const tenantsTableFragment = graphql`
  fragment tenantsTable_query on Query
  @refetchable(queryName: "tenantsTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    filter: { type: "DirectoryConnectionFilterInput" }
    orderBy: { type: "DirectoryConnectionOrderInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryConnections(search: $search, filter: $filter, orderBy: $orderBy, first: $first, after: $after)
      @connection(key: "tenantsTable_directoryConnections") {
      totalCount
      edges {
        node {
          id
          name
          provider
          domain
          userCount
          unattributedUserCount
          lastSyncAt
          enabled
          licenseSummary {
            assigned
            purchased
            unused
          }
          access {
            state
          }
          customers {
            ...boundCustomer_customer
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

const tenantRowHref = (row: TenantRow) => routes.cloudTenantManagement.details(row.id);

interface TenantsTableProps {
  search: string;
  /** The deferred funnels and sort: they feed the query. */
  filter: DirectoryConnectionFilterInput | null;
  orderBy: DirectoryConnectionOrderInput | null;
  /** The live funnels: what the headers draw, so a tick lands instantly. */
  filters: TenantsTableFilters;
  /** The deferred search lags the typed one: the rows on screen are the previous result. */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The tenant rows, with their own boundary: in its scope the reader draws its own loading form. */
export function TenantsTable(props: TenantsTableProps) {
  return (
    <LoadingSuspense label="Loading tenants">
      <TenantsTableReader {...props} />
    </LoadingSuspense>
  );
}

/**
 * In a loading scope (its boundary's fallback, or the module's flag window) it draws the table with no rows, which
 * is the table's own loading state; otherwise it runs the query, which suspends.
 */
function TenantsTableReader(props: TenantsTableProps) {
  if (useLoadingScope()) {
    return (
      <TenantsTableView
        rows={NO_ITEMS}
        getHref={tenantRowHref}
        search={props.search}
        filters={props.filters}
        isPending={props.isPending}
        totalCount={0}
        stickyHeaderOffset={props.stickyHeaderOffset}
        skeletonRows={TENANTS_PAGE_SIZE}
        {...NO_NEXT_PAGE}
      />
    );
  }
  return <TenantsTableQuery {...props} />;
}

function TenantsTableQuery({
  search,
  filter,
  orderBy,
  filters,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: TenantsTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<TenantsTableQueryType>(
    tenantsTableQuery,
    { search: search || null, filter, orderBy, first: TENANTS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    tenantsTablePaginationQuery,
    tenantsTable_query$key
  >(tenantsTableFragment, queryData);

  const { edges, totalCount } = data.directoryConnections;
  const rows = useMemo<TenantRow[]>(
    () =>
      edges.map(({ node }) => {
        // `Instant` scalars are untyped (`any`); `unknown` keeps them out of the rest of the render.
        const lastSyncAt: unknown = node.lastSyncAt;
        return {
          id: node.id,
          name: node.name,
          provider: node.provider,
          domain: node.domain,
          customers: boundCustomerOptions(node.customers).map(({ name, image }) => ({
            name,
            imageUrl: getFullImageUrl(image?.imageUrl, image?.hash),
          })),
          userCount: node.userCount,
          unattributedUserCount: node.unattributedUserCount,
          accessState: node.access.state,
          lastReadAt: lastReadAt({ lastSyncAt }),
          syncPaused: isSyncPaused(node),
          licenses: node.licenseSummary,
        };
      }),
    [edges],
  );

  const showEmptyState = !search && !filter && !isPending && rows.length === 0;
  // Before paint: the view hides its search toolbar over the empty state, so it must not flash first.
  useLayoutEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<CodingForkIcon />}
        title="No tenants connected yet"
        description="Connect a Microsoft 365 or Google Workspace tenant to see its users and access state here."
        buttonLabel="Connect Tenant"
        buttonProps={{ href: routes.cloudTenantManagement.new() }}
      />
    );
  }

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(TENANTS_PAGE_SIZE);
  };

  return (
    <TenantsTableView
      rows={rows}
      getHref={tenantRowHref}
      search={search}
      filters={filters}
      isPending={isPending}
      totalCount={totalCount}
      stickyHeaderOffset={stickyHeaderOffset}
      skeletonRows={TENANTS_PAGE_SIZE}
      hasNextPage={hasNext}
      isFetchingNextPage={isLoadingNext}
      onLoadMore={fetchNextPage}
    />
  );
}
