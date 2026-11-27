'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { BookBookmarkIcon, Link01BreakIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type AutoRefreshControlProps,
  type ColumnDef,
  type Row,
  useDataTable,
  LoadingWhen,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  type CursorPagerFooterProps,
  type CursorPagerVariables,
  type UseCursorPagerReturn,
  useToast,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type {
  assignedArticlesTableQuery$data,
  assignedArticlesTableQuery as AssignedArticlesTableQueryType,
} from '@/__generated__/assignedArticlesTableQuery.graphql';
import type { assignedArticlesTableUnassignMutation as AssignedArticlesTableUnassignMutationType } from '@/__generated__/assignedArticlesTableUnassignMutation.graphql';
import { EmptyState, liveColumnMeta, NO_ITEMS, noop, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useGridTableProps } from '@/app/hooks/use-table-layout';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { markListChanged, useListRefreshEpoch } from '@/lib/list-refresh';
import { routes } from '@/lib/routes';
import { KnowledgeBaseItemCreatedCell } from '../item-list/knowledge-base-item-created-cell';
import {
  KNOWLEDGE_BASE_DATE_GRID,
  KNOWLEDGE_BASE_NAME_GRID,
  knowledgeBaseMenuColumn,
  knowledgeBaseOpenColumn,
} from '../shared/knowledge-base-grid-columns';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import { type AssignedArticlesTarget, targetNoun } from './assigned-articles-target';

/**
 * The articles assigned to one customer or device, from every folder: drafts
 * included, archived left out, most recently updated first — all decided by the
 * server once `assignedTo` is set. One page per request, its cursor in the URL
 * under the tab's prefix (`articlesCursor`; no `@connection`: a cursor from a link
 * must read exactly its page). `knowledgeBaseItems` pages forward only.
 */
const assignedArticlesTableQuery = graphql`
  query assignedArticlesTableQuery($filter: KnowledgeBaseFilterInput, $search: String, $first: Int!, $after: String) {
    knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          id
          name
          ...knowledgeBaseItemNameCell_item
          ...knowledgeBaseItemCreatedCell_item
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

const assignedArticlesTableUnassignMutation = graphql`
  mutation assignedArticlesTableUnassignMutation($itemId: ID!, $targetType: AssignmentTargetType!, $targetId: ID!) {
    unassignItem(itemId: $itemId, targetType: $targetType, targetId: $targetId)
  }
`;

type ArticleRow = assignedArticlesTableQuery$data['knowledgeBaseItems']['edges'][number]['node'];

const getRowId = (row: ArticleRow) => row.id;
const rowHref = (row: ArticleRow) => routes.knowledgeBase.details(row.id);

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

function buildColumns(onUnassign: (row: ArticleRow) => void): ColumnDef<ArticleRow>[] {
  return [
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
      cell: ({ row }: { row: Row<ArticleRow> }) => <KnowledgeBaseItemNameCell item={row.original} />,
      enableSorting: false,
      ...KNOWLEDGE_BASE_NAME_GRID,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name, {
        label: 'Name',
        gridCell: ({ row }: { row: Row<ArticleRow> }) => <KnowledgeBaseItemNameCell item={row.original} grid />,
      }),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.created.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.created.header,
      cell: ({ row }: { row: Row<ArticleRow> }) => <KnowledgeBaseItemCreatedCell item={row.original} />,
      enableSorting: false,
      ...KNOWLEDGE_BASE_DATE_GRID,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.created, {
        label: 'Created',
        gridCell: ({ row }: { row: Row<ArticleRow> }) => <KnowledgeBaseItemCreatedCell item={row.original} grid />,
      }),
    },
    knowledgeBaseMenuColumn<ArticleRow>(({ row }) => (
      // `data-no-row-click` keeps the row's own link from firing underneath the menu.
      <div data-no-row-click className="pointer-events-auto flex justify-end">
        <ActionsMenuDropdown
          groups={[
            {
              items: [
                {
                  id: 'unassign',
                  label: 'Unassign',
                  icon: <Link01BreakIcon className={ICON_CLASS} />,
                  onClick: () => onUnassign(row.original),
                },
              ],
            },
          ]}
        />
      </div>
    )),
    knowledgeBaseOpenColumn<ArticleRow>(rowHref),
  ];
}

/** The key of the viewer's saved column layout: one for the tab, on a customer's page and on a device's. */
const ASSIGNED_ARTICLES_TABLE_KEY = 'assigned-articles';

export interface AssignedArticlesListing {
  search: string;
  tagIds: readonly string[];
}

interface AssignedArticlesTableProps {
  /** Null while the page has not read whose articles these are: the table draws its loading state and asks nothing. */
  target: AssignedArticlesTarget | null;
  /** Deferred — feeds the query (lags the search box and the tag chips during a refetch). */
  listing: AssignedArticlesListing;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** An unassign went through — the tab refreshes what else reads the set (the article page's assignees). */
  onChanged: () => void;
  /** Nothing assigned at all (not a search or tag miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The tab's URL prefix: its auto-refresh interval sits beside its other params (`articlesRefresh`). */
  paramPrefix: string;
}

/**
 * The rows of the Assigned Articles tab, paged on the server (First · Prev · Next), with their own boundary. In a
 * loading scope (the boundary's fallback) the reader draws the table over one page of placeholder rows with their real
 * cells, each in its own loading form; otherwise it runs the query, which suspends under that boundary. A cursor the
 * server refuses drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
export function AssignedArticlesTable(props: AssignedArticlesTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <AssignedArticlesTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function AssignedArticlesTableLoading(props: AssignedArticlesTableProps) {
  return (
    <LoadingSuspense label="Loading articles">
      <AssignedArticlesTableReader {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read. */
function AssignedArticlesTableReader(props: AssignedArticlesTableProps) {
  const { target } = props;
  const scoped = useLoadingScope();
  // While the table flag is read the table draws its loading state too (and reads nothing): it never draws one layout
  // and swaps to the other.
  const { loading: flagLoading } = useGridTableProps(ASSIGNED_ARTICLES_TABLE_KEY);
  if (scoped || flagLoading || target == null) {
    return (
      <LoadingWhen loading>
        <AssignedArticlesRows {...props} rows={NO_ITEMS} totalCount={0} onUnassign={noop} pager={null} />
      </LoadingWhen>
    );
  }
  return <AssignedArticlesTableQuery {...props} target={target} />;
}

/**
 * The page the URL names, its footer and the auto-refresh. An assign (the tab's dialog), an unassign (a row's menu)
 * or an article saved with other customers or devices changes which articles the page holds, which is the server's
 * answer: it marks the list changed and the page is read again (`useListRefreshEpoch`), keeping the rows on screen
 * until it arrives.
 */
function AssignedArticlesTableQuery({
  pager,
  pageVariables,
  paramPrefix,
  ...props
}: AssignedArticlesTableProps & { target: AssignedArticlesTarget }) {
  const { target, listing, isPending, onChanged } = props;
  const { toast } = useToast();
  const retryKey = useRetryKey();
  const changed = useListRefreshEpoch('assignedItems');

  const variables: AssignedArticlesTableQueryType['variables'] = {
    filter: {
      assignedTo: { targetType: target.targetType, targetId: target.targetId },
      tagIds: listing.tagIds.length > 0 ? [...listing.tagIds] : null,
    },
    search: listing.search || null,
    ...forwardPage(pageVariables, KNOWLEDGE_BASE_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<AssignedArticlesTableQueryType>(assignedArticlesTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${changed}`,
  });
  const refetch = useRefetchPage<AssignedArticlesTableQueryType>(assignedArticlesTableQuery, variables);
  const { edges, pageInfo, filteredCount } = queryData.knowledgeBaseItems;
  // Inside another page's tab: its auto-refresh interval sits under the tab's prefix.
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, prefix: paramPrefix, refetch, isPending });

  const [commitUnassign] = useMutation<AssignedArticlesTableUnassignMutationType>(
    assignedArticlesTableUnassignMutation,
  );

  const handleUnassign = (row: ArticleRow) => {
    commitUnassign({
      variables: { itemId: row.id, targetType: target.targetType, targetId: target.targetId },
      onCompleted: () => {
        // The answer is a bare Boolean: what the page holds now is the server's to say, so the list reads it again.
        markListChanged('assignedItems');
        toast({ title: 'Article unassigned', description: row.name, variant: 'success' });
        onChanged();
      },
      onError: error => {
        toast({
          title: 'Unassign failed',
          description: getRelayErrorMessage(error, 'Unable to unassign the article'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AssignedArticlesRows
      {...props}
      rows={edges.map(edge => edge.node)}
      totalCount={filteredCount}
      onUnassign={handleUnassign}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

interface AssignedArticlesRowsProps extends Omit<
  AssignedArticlesTableProps,
  'pager' | 'pageVariables' | 'paramPrefix'
> {
  rows: readonly ArticleRow[];
  /** The server's total for the search and the tags, not the rows on the page. */
  totalCount: number;
  onUnassign: (row: ArticleRow) => void;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function AssignedArticlesRows({
  rows,
  totalCount,
  onUnassign,
  pager,
  refresh,
  target,
  listing,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: AssignedArticlesRowsProps) {
  const loading = useLoadingScope();
  // The new grid table, behind the app's one table flag; card rows while it is off. The tab is a section of a
  // details page, so the table keeps its natural height and the page scrolls.
  const tableGrid = useGridTableProps(ASSIGNED_ARTICLES_TABLE_KEY);
  const hasFilters = listing.search !== '' || listing.tagIds.length > 0;
  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<ArticleRow>(KNOWLEDGE_BASE_PAGE_SIZE) : null),
    [loading],
  );
  const table = useDataTable<ArticleRow>({
    // The table only ever reads the page it is handed.
    data: placeholderRows ?? (rows as ArticleRow[]),
    columns: buildColumns(onUnassign),
    getRowId,
    enableSorting: false,
  });

  // A search or a tag filter that finds nothing keeps the table (its own "no
  // match" row); nothing assigned at all gets the tab's empty state instead. An
  // empty LATER page (a cursor about to be dropped) keeps the table and its pager.
  const isFirstPage = pager?.isFirstPage ?? true;
  const showEmptyState = !loading && !hasFilters && !isPending && isFirstPage && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  // `showEmptyState` holds only once loaded, and a table with no target is always loading.
  if (showEmptyState && target) {
    return (
      <EmptyState
        icon={<BookBookmarkIcon />}
        title="No articles yet"
        description={`Articles assigned to this ${targetNoun(target)} will appear here.`}
      />
    );
  }

  return (
    <LiveTable
      table={table}
      pageSize={KNOWLEDGE_BASE_PAGE_SIZE}
      loadingCells={loading}
      totalCount={totalCount}
      itemName="article"
      emptyState={oneLineEmptyState(
        listing.search
          ? `No articles found matching "${listing.search}". Try adjusting your search.`
          : 'No articles match the selected tags. Try adjusting your filters.',
      )}
      rowHref={rowHref}
      pager={pager}
      refresh={refresh}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
      layout={tableGrid.layout}
      settings={tableGrid.settings}
    />
  );
}
