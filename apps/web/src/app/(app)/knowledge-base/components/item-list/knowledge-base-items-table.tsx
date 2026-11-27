'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { BookBookmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  type ColumnDef,
  LoadingWhen,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type {
  CursorPagerFooterProps,
  CursorPagerVariables,
  UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  knowledgeBaseItemsTableQuery$data,
  knowledgeBaseItemsTableQuery as KnowledgeBaseItemsTableQueryType,
} from '@/__generated__/knowledgeBaseItemsTableQuery.graphql';
import { useMingoCreatedEpoch } from '@/app/(app)/mingo/stores/mingo-created-entities-store';
import { EmptyState, liveColumnMeta, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useRowDialog } from '@/app/components/shared/use-row-dialog';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useGridTableProps } from '@/app/hooks/use-table-layout';
import { useListRefreshEpoch } from '@/lib/list-refresh';
import { ROOT_FOLDER } from '../shared/folder-tree';
import {
  KNOWLEDGE_BASE_DATE_GRID,
  KNOWLEDGE_BASE_NAME_GRID,
  knowledgeBaseMenuColumn,
  knowledgeBaseOpenColumn,
} from '../shared/knowledge-base-grid-columns';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { knowledgeBaseItemHref } from '../shared/knowledge-base-item-href';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import {
  isSubtreeListing,
  type KnowledgeBaseListing,
  knowledgeBaseListingArgs,
} from '../shared/knowledge-base-listings';
import { type ItemDialogKind, KnowledgeBaseItemActionsCell } from './knowledge-base-item-actions-cell';
import { KnowledgeBaseItemCreatedCell } from './knowledge-base-item-created-cell';
import { KnowledgeBaseItemDialogs } from './knowledge-base-item-dialogs';

/**
 * One level of the knowledge base — the root or a folder — as ONE paged list:
 * folders first, by name, then articles, newest change first. Browsing lists the
 * level itself; a search or a tag filter goes to the server and lists everything
 * under the level, at any depth.
 *
 * One page per request, its cursor in the URL (`cursor`; no `@connection`: a cursor from a link must read exactly its
 * page). `knowledgeBaseItems` pages forward only (`first` / `after`).
 */
const knowledgeBaseItemsTableQuery = graphql`
  query knowledgeBaseItemsTableQuery($filter: KnowledgeBaseFilterInput, $search: String, $first: Int!, $after: String) {
    knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          id
          # Where the row leads: a folder opens its listing, an article its page.
          type
          # The folder the row is in. A search or a tag filter lists a whole
          # subtree, so there the name says it; null is the root level.
          parent {
            name
          }
          ...knowledgeBaseItemNameCell_item
          ...knowledgeBaseItemCreatedCell_item
          ...knowledgeBaseItemActionsCell_item
          ...knowledgeBaseItemDialogs_item
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

type ItemRow = knowledgeBaseItemsTableQuery$data['knowledgeBaseItems']['edges'][number]['node'];

const getRowId = (row: ItemRow) => row.id;
const rowHref = (row: ItemRow) => knowledgeBaseItemHref(row.type, row.id);

function buildColumns(
  isSubtree: boolean,
  onOpenDialog: (row: ItemRow, dialog: ItemDialogKind) => void,
): ColumnDef<ItemRow>[] {
  // The folder a row is in, where the list says it (a search or a tag filter lists a whole subtree).
  const folderOf = (row: ItemRow) => (isSubtree ? (row.parent?.name ?? ROOT_FOLDER.name) : undefined);
  return [
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
      cell: ({ row }: { row: Row<ItemRow> }) => (
        <KnowledgeBaseItemNameCell item={row.original} folder={folderOf(row.original)} />
      ),
      enableSorting: false,
      ...KNOWLEDGE_BASE_NAME_GRID,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name, {
        label: 'Name',
        gridCell: ({ row }: { row: Row<ItemRow> }) => (
          <KnowledgeBaseItemNameCell item={row.original} folder={folderOf(row.original)} grid />
        ),
      }),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.created.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.created.header,
      cell: ({ row }: { row: Row<ItemRow> }) => <KnowledgeBaseItemCreatedCell item={row.original} />,
      enableSorting: false,
      ...KNOWLEDGE_BASE_DATE_GRID,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.created, {
        label: 'Created',
        gridCell: ({ row }: { row: Row<ItemRow> }) => <KnowledgeBaseItemCreatedCell item={row.original} grid />,
      }),
    },
    knowledgeBaseMenuColumn<ItemRow>(({ row }) => (
      <KnowledgeBaseItemActionsCell item={row.original} onOpen={dialog => onOpenDialog(row.original, dialog)} />
    )),
    knowledgeBaseOpenColumn<ItemRow>(rowHref),
  ];
}

/** The key of the viewer's saved column layout: one for every level of the knowledge base. */
const ITEMS_TABLE_KEY = 'knowledge-base-items';

interface KnowledgeBaseItemsTableProps {
  /** Deferred — feeds the query (lags the search box and the tag chips during a refetch). */
  listing: KnowledgeBaseListing;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** Nothing on this level at all (not a search or tag miss) — the view drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * The rows of a knowledge base level, paged on the server (First · Prev · Next), with their own boundary. In a loading
 * scope (the boundary's fallback) the reader draws the table over one page of placeholder rows with their real cells,
 * each in its own loading form; otherwise it runs the query, which suspends under that boundary. A cursor the server
 * refuses drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
export function KnowledgeBaseItemsTable(props: KnowledgeBaseItemsTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <KnowledgeBaseItemsTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function KnowledgeBaseItemsTableLoading(props: KnowledgeBaseItemsTableProps) {
  return (
    <LoadingSuspense label="Loading articles">
      <KnowledgeBaseItemsTableReader {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read. */
function KnowledgeBaseItemsTableReader(props: KnowledgeBaseItemsTableProps) {
  const scoped = useLoadingScope();
  // While the table flag is read the table draws its loading state too (and reads nothing): it never draws one layout
  // and swaps to the other.
  const { loading: flagLoading } = useGridTableProps(ITEMS_TABLE_KEY, { fill: true });
  if (scoped || flagLoading) {
    return (
      <LoadingWhen loading>
        <KnowledgeBaseItemsRows {...props} rows={NO_ITEMS} totalCount={0} pager={null} />
      </LoadingWhen>
    );
  }
  return <KnowledgeBaseItemsTableQuery {...props} />;
}

/**
 * The page the URL names, its footer and the auto-refresh. A row dialog (archive, move, delete), a new folder or a
 * saved article changes which items the page holds, which is the server's answer: it marks the list changed and the
 * page is read again (`useListRefreshEpoch`), keeping the rows on screen until it arrives.
 */
function KnowledgeBaseItemsTableQuery({ pager, pageVariables, ...props }: KnowledgeBaseItemsTableProps) {
  const { listing, isPending } = props;
  const retryKey = useRetryKey();
  // Mingo can add a row from the chat; its create refetches the list.
  const mingoCreated = useMingoCreatedEpoch('knowledgeBase');
  const changed = useListRefreshEpoch('knowledgeBase');

  const variables: KnowledgeBaseItemsTableQueryType['variables'] = {
    ...knowledgeBaseListingArgs(listing),
    ...forwardPage(pageVariables, KNOWLEDGE_BASE_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<KnowledgeBaseItemsTableQueryType>(knowledgeBaseItemsTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${mingoCreated}:${changed}`,
  });
  const refetch = useRefetchPage<KnowledgeBaseItemsTableQueryType>(knowledgeBaseItemsTableQuery, variables);
  const { edges, pageInfo, filteredCount } = queryData.knowledgeBaseItems;
  // A top-level page: its auto-refresh interval has no prefix, as its other params.
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, refetch, isPending });

  return (
    <KnowledgeBaseItemsRows
      {...props}
      rows={edges.map(edge => edge.node)}
      totalCount={filteredCount}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

interface KnowledgeBaseItemsRowsProps extends Omit<KnowledgeBaseItemsTableProps, 'pager' | 'pageVariables'> {
  rows: readonly ItemRow[];
  /** The server's total for the level and what narrows it, not the rows on the page. */
  totalCount: number;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function KnowledgeBaseItemsRows({
  rows,
  totalCount,
  pager,
  refresh,
  listing,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: KnowledgeBaseItemsRowsProps) {
  const loading = useLoadingScope();
  // The new grid table, behind the app's one table flag; card rows while it is off. The list is the page's main
  // content, so in the grid it is the page's scroll area.
  const tableGrid = useGridTableProps(ITEMS_TABLE_KEY, { fill: true });
  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<ItemRow, ItemDialogKind>();

  const isSubtree = isSubtreeListing(listing);
  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<ItemRow>(KNOWLEDGE_BASE_PAGE_SIZE) : null),
    [loading],
  );
  const table = useDataTable<ItemRow>({
    // The table only ever reads the page it is handed.
    data: placeholderRows ?? (rows as ItemRow[]),
    columns: buildColumns(isSubtree, openDialog),
    getRowId,
    enableSorting: false,
  });

  // A search or a tag filter that finds nothing keeps the table (its own "no
  // match" row); a level with nothing on it gets the page's empty state instead.
  // An empty LATER page (a cursor about to be dropped) keeps the table and its
  // pager, so First stays reachable.
  const isFirstPage = pager?.isFirstPage ?? true;
  const showEmptyState = !loading && !isSubtree && !isPending && isFirstPage && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  return (
    <>
      {showEmptyState ? (
        <EmptyState
          icon={<BookBookmarkIcon />}
          title="No articles or folders yet"
          description="Create your first article or folder to start building your knowledge base"
        />
      ) : (
        <LiveTable
          table={table}
          pageSize={KNOWLEDGE_BASE_PAGE_SIZE}
          loadingCells={loading}
          totalCount={totalCount}
          itemName="item"
          emptyState={oneLineEmptyState(
            listing.search
              ? `No articles or folders found matching "${listing.search}". Try adjusting your search.`
              : 'No articles match the selected tags. Try adjusting your filters.',
          )}
          rowHref={rowHref}
          pager={pager}
          refresh={refresh}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
          layout={tableGrid.layout}
          maxHeight={tableGrid.maxHeight}
          settings={tableGrid.settings}
        />
      )}

      {/* Outside both branches: deleting the last row swaps the table for the empty state mid-dialog. */}
      {dialog && (
        <KnowledgeBaseItemDialogs item={dialog.row} kind={dialog.kind} isOpen={dialog.isOpen} onClose={closeDialog} />
      )}
    </>
  );
}
