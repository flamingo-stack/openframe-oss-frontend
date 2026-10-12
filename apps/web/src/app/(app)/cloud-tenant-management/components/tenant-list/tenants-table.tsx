'use client';

import {
  lastReadAt,
  type TenantRow,
  TenantsTableView,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { CodingForkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { tenantsTable_query$key } from '@/__generated__/tenantsTable_query.graphql';
import type { tenantsTablePaginationQuery } from '@/__generated__/tenantsTablePaginationQuery.graphql';
import type { tenantsTableQuery as TenantsTableQueryType } from '@/__generated__/tenantsTableQuery.graphql';
import { EmptyState, useRetryKey } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';

export const TENANTS_PAGE_SIZE = 20;

const tenantsTableQuery = graphql`
  query tenantsTableQuery($search: String, $first: Int!, $after: String) {
    ...tenantsTable_query @arguments(search: $search, first: $first, after: $after)
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
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryConnections(search: $search, first: $first, after: $after)
      @connection(key: "tenantsTable_directoryConnections") {
      totalCount
      edges {
        node {
          id
          name
          provider
          domain
          userCount
          lastSyncAt
          access {
            state
          }
          organization {
            name
            image {
              imageUrl
              hash
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

const tenantRowHref = (row: TenantRow) => routes.cloudTenantManagement.details(row.id);

interface TenantsTableProps {
  search: string;
  /** The deferred search lags the typed one: the rows on screen are the previous result. */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The tenant rows: suspends on the query, so it lives under the view's `<Suspense>`. */
export function TenantsTable({ search, isPending, onEmptyChange, stickyHeaderOffset }: TenantsTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<TenantsTableQueryType>(
    tenantsTableQuery,
    { search: search || null, first: TENANTS_PAGE_SIZE, after: null },
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
          customer: {
            name: node.organization.name,
            imageUrl: getFullImageUrl(node.organization.image?.imageUrl, node.organization.image?.hash),
          },
          userCount: node.userCount,
          accessState: node.access.state,
          lastReadAt: lastReadAt({ lastSyncAt }),
        };
      }),
    [edges],
  );

  const showEmptyState = !search && !isPending && rows.length === 0;
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
