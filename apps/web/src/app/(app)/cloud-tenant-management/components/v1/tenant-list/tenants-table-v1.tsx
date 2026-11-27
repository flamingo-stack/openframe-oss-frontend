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
  AutoRefreshControl,
  type DataTableSettings,
  LoadingWhen,
  type TableMetaRow,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { CursorPagerVariables, UseCursorPagerReturn } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantsTableV1Query as TenantsTableQueryType } from '@/__generated__/tenantsTableV1Query.graphql';
import { EmptyState, NO_ITEMS, useRetryKey } from '@/app/components/shared';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';

/** How many tenants a page holds. */
export const TENANTS_V1_PAGE_SIZE = 20;

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

/** The row above the table while the first page is read: the pager drawn, waiting. */
const LOADING_META_ROW: TableMetaRow = { pager: null };

// One page of tenants per request, its cursor in the URL (no `@connection`: a cursor from a link must read exactly its
// page); `directoryConnections` pages forward only (`first` / `after`). The fields of a row are the core library's
// `TenantRow`: its cells take plain props, so the selection lives here. `access` is a (TTL-cached) provider probe per
// row; the list is where the design shows it.
const tenantsTableV1Query = graphql`
  query tenantsTableV1Query($search: String, $first: Int!, $after: String) {
    directoryConnections(search: $search, first: $first, after: $after) {
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
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const tenantRowHref = (row: TenantRow) => routes.cloudTenantManagement.details(row.id);

interface TenantsTableProps {
  /** Deferred — the URL's search (never the box's: see the view). */
  search: string;
  /** A deferred value lags the URL: the rows on screen are the previous result (dimmed, the pager waiting). */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * The tenant rows, paged on the server (First · Prev · Next), with their own boundary: in its scope the reader draws
 * its own loading form. A cursor the server refuses drops to the first page (`StaleCursorBoundary`); any other error
 * goes up unchanged.
 *
 * The table's layout is the app's one table flag: the grid where it is on, card rows where it is off. Until the flag
 * is answered the rows are a loading scope, so one table is never drawn and then replaced by the other.
 */
export function TenantsTableV1(props: TenantsTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <TenantsTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function TenantsTableLoading(props: TenantsTableProps) {
  return (
    <LoadingSuspense label="Loading tenants">
      <TenantsTableGate {...props} />
    </LoadingSuspense>
  );
}

/**
 * Reads the app's table flag under the boundary, so the boundary's fallback and the read rows draw the same layout.
 * Until the flag is answered the reader below is in a loading scope: it draws its loading form and does not fetch.
 */
function TenantsTableGate(props: TenantsTableProps) {
  const tableGate = useTableGridGate();
  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <TenantsTableReader {...props} layout={tableLayoutFor(tableGate)} />
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
        skeletonRows={TENANTS_V1_PAGE_SIZE}
        metaRow={LOADING_META_ROW}
        {...tenantsTableLayoutProps(props.layout)}
      />
    );
  }
  return <TenantsTableQuery {...props} />;
}

/** The page the URL names, its pager and the auto-refresh, through the lib view's row above the table. */
function TenantsTableQuery({
  search,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  layout,
  pager,
  pageVariables,
}: TenantsTableReaderProps) {
  const retryKey = useRetryKey();
  const variables: TenantsTableQueryType['variables'] = {
    search: search || null,
    ...forwardPage(pageVariables, TENANTS_V1_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<TenantsTableQueryType>(tenantsTableV1Query, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<TenantsTableQueryType>(tenantsTableV1Query, variables);
  const { edges, totalCount, pageInfo } = queryData.directoryConnections;
  // A top-level page: its auto-refresh interval has no prefix, as its other params.
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, refetch, isPending });
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

  // An empty LATER page (a cursor about to be dropped) keeps the table and its pager, so First stays reachable.
  const showEmptyState = !search && !isPending && pager.isFirstPage && rows.length === 0;
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

  return (
    <TenantsTableView
      rows={rows}
      getHref={tenantRowHref}
      search={search}
      isPending={isPending}
      totalCount={totalCount}
      stickyHeaderOffset={stickyHeaderOffset}
      skeletonRows={TENANTS_V1_PAGE_SIZE}
      // The pager and the auto-refresh picker in the row above the table, the range over the server's total in place
      // of the count. The view holds the pager's buttons while `isPending` itself.
      metaRow={{ pager: paged.pager, actions: <AutoRefreshControl {...paged.refresh} /> }}
      {...tenantsTableLayoutProps(layout)}
    />
  );
}
