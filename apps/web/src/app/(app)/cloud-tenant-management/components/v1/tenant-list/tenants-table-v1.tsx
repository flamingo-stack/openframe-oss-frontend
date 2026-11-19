'use client';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-list/tenants-table.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  lastReadAt,
  type TenantRow,
  TenantsTableView,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { CodingForkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type DataTableSettings,
  LoadingWhen,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { tenantsTableV1_query$key } from '@/__generated__/tenantsTableV1_query.graphql';
import type { tenantsTableV1PaginationQuery } from '@/__generated__/tenantsTableV1PaginationQuery.graphql';
import type { tenantsTableV1Query as TenantsTableQueryType } from '@/__generated__/tenantsTableV1Query.graphql';
import { EmptyState, NO_NEXT_PAGE, useRetryKey, NO_ITEMS } from '@/app/components/shared';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';

const TENANTS_PAGE_SIZE = 20;

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order,
 * resized widths) kept in the browser under this table's own key.
 */
const TENANTS_TABLE_SETTINGS: DataTableSettings = { storageKey: 'cloud-tenants-v1' };

/**
 * What both of the table's branches (its loading form and the read rows) hand the view, so a refetch never swaps one
 * layout for the other. The grid table is the page's scroll area (`fill`); card rows read neither the height nor the
 * settings.
 */
const tenantsTableLayoutProps = (layout: TableLayout) =>
  ({ layout, tableMaxHeight: 'fill', tableSettings: TENANTS_TABLE_SETTINGS }) as const;

const tenantsTableV1Query = graphql`
  query tenantsTableV1Query($search: String, $first: Int!, $after: String) {
    ...tenantsTableV1_query @arguments(search: $search, first: $first, after: $after)
  }
`;

// The fields of a row are the core library's `TenantRow`: its cells take plain props, so the
// selection lives here. `access` is a (TTL-cached) provider probe per row; the list is where the
// design shows it.
const tenantsTableFragment = graphql`
  fragment tenantsTableV1_query on Query
  @refetchable(queryName: "tenantsTableV1PaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    directoryConnections(search: $search, first: $first, after: $after)
      @connection(key: "tenantsTableV1_directoryConnections") {
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

/**
 * The tenant rows, with their own boundary: in its scope the reader draws its own loading form.
 *
 * The table's layout is the app's one table flag: the grid where it is on, card rows where it is off. Until the flag
 * is answered the rows are a loading scope, so one table is never drawn and then replaced by the other.
 */
export function TenantsTableV1(props: TenantsTableProps) {
  const tableGate = useTableGridGate();
  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <LoadingSuspense label="Loading tenants">
        <TenantsTableReader {...props} layout={tableLayoutFor(tableGate)} />
      </LoadingSuspense>
    </LoadingWhen>
  );
}

/** What the reader and the query take: the table's props and the layout both of their tables draw. */
type TenantsTableReaderProps = TenantsTableProps & { layout: TableLayout };

/**
 * In a loading scope (its boundary's fallback, or the module's flag window) it draws the table with no rows, which
 * is the table's own loading state; otherwise it runs the query, which suspends.
 */
function TenantsTableReader(props: TenantsTableReaderProps) {
  if (useLoadingScope()) {
    return (
      <TenantsTableView
        rows={NO_ITEMS}
        getHref={tenantRowHref}
        search={props.search}
        isPending={props.isPending}
        totalCount={0}
        stickyHeaderOffset={props.stickyHeaderOffset}
        skeletonRows={TENANTS_PAGE_SIZE}
        {...NO_NEXT_PAGE}
        {...tenantsTableLayoutProps(props.layout)}
      />
    );
  }
  return <TenantsTableQuery {...props} />;
}

function TenantsTableQuery({ search, isPending, onEmptyChange, stickyHeaderOffset, layout }: TenantsTableReaderProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<TenantsTableQueryType>(
    tenantsTableV1Query,
    { search: search || null, first: TENANTS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    tenantsTableV1PaginationQuery,
    tenantsTableV1_query$key
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
            name: node.organization?.name ?? '',
            imageUrl: getFullImageUrl(node.organization?.image?.imageUrl, node.organization?.image?.hash),
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
      {...tenantsTableLayoutProps(layout)}
    />
  );
}
