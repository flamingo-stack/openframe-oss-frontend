'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
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
import { useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  archivedArticlesTableQuery$data,
  archivedArticlesTableQuery as ArchivedArticlesTableQueryType,
} from '@/__generated__/archivedArticlesTableQuery.graphql';
import { liveColumnMeta, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useRowDialog } from '@/app/components/shared/use-row-dialog';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useGridTableProps } from '@/app/hooks/use-table-layout';
import { useListRefreshEpoch } from '@/lib/list-refresh';
import { routes } from '@/lib/routes';
import { UnarchiveArticleModal } from '../dialogs/unarchive-article-modal';
import {
  KNOWLEDGE_BASE_DATE_GRID,
  KNOWLEDGE_BASE_NAME_GRID,
  knowledgeBaseMenuColumn,
  knowledgeBaseOpenColumn,
} from '../shared/knowledge-base-grid-columns';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import { ArchivedArticleActionsCell } from './archived-article-actions-cell';
import { ArchivedArticleDateCell } from './archived-article-date-cell';
import { ARCHIVED_COLUMN } from './archived-articles-columns';

/**
 * Every archived article of the knowledge base, whichever folder it was archived from — newest first. One page per
 * request, its cursor in the URL (`cursor`; no `@connection`: a cursor from a link must read exactly its page).
 * `archivedArticles` pages forward only (`first` / `after`).
 */
const archivedArticlesTableQuery = graphql`
  query archivedArticlesTableQuery($search: String, $tagIds: [ID], $first: Int!, $after: String) {
    archivedArticles(search: $search, tagIds: $tagIds, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          id
          ...knowledgeBaseItemNameCell_item
          ...archivedArticleDateCell_article
          ...unarchiveArticleModal_article
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

type ArchivedRow = archivedArticlesTableQuery$data['archivedArticles']['edges'][number]['node'];

const getRowId = (row: ArchivedRow) => row.id;
const rowHref = (row: ArchivedRow) => routes.knowledgeBase.details(row.id);

function buildColumns(onUnarchive: (row: ArchivedRow) => void): ColumnDef<ArchivedRow>[] {
  return [
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
      cell: ({ row }: { row: Row<ArchivedRow> }) => <KnowledgeBaseItemNameCell item={row.original} />,
      enableSorting: false,
      ...KNOWLEDGE_BASE_NAME_GRID,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name, {
        label: 'Name',
        gridCell: ({ row }: { row: Row<ArchivedRow> }) => <KnowledgeBaseItemNameCell item={row.original} grid />,
      }),
    },
    {
      id: ARCHIVED_COLUMN.id,
      header: ARCHIVED_COLUMN.header,
      cell: ({ row }: { row: Row<ArchivedRow> }) => <ArchivedArticleDateCell article={row.original} />,
      enableSorting: false,
      ...KNOWLEDGE_BASE_DATE_GRID,
      meta: liveColumnMeta(ARCHIVED_COLUMN, {
        label: 'Archived',
        gridCell: ({ row }: { row: Row<ArchivedRow> }) => <ArchivedArticleDateCell article={row.original} grid />,
      }),
    },
    knowledgeBaseMenuColumn<ArchivedRow>(({ row }) => (
      <ArchivedArticleActionsCell onUnarchive={() => onUnarchive(row.original)} />
    )),
    knowledgeBaseOpenColumn<ArchivedRow>(rowHref),
  ];
}

/** The key of the viewer's saved column layout. */
const ARCHIVE_TABLE_KEY = 'knowledge-base-archive';

interface ArchivedArticlesTableProps {
  /** Deferred — feeds the query (lags the search box during a refetch). */
  search: string;
  /** Deferred — feeds the query (lags the tag chips during a refetch). */
  tagIds: readonly string[];
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * The archive's rows, paged on the server (First · Prev · Next), with their own boundary. In a loading scope (the
 * boundary's fallback) the reader draws the table over one page of placeholder rows with their real cells, each in its
 * own loading form; otherwise it runs the query, which suspends under that boundary. A cursor the server refuses drops
 * to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
export function ArchivedArticlesTable(props: ArchivedArticlesTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <ArchivedArticlesTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function ArchivedArticlesTableLoading(props: ArchivedArticlesTableProps) {
  return (
    <LoadingSuspense label="Loading archived articles">
      <ArchivedArticlesTableReader {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read. */
function ArchivedArticlesTableReader(props: ArchivedArticlesTableProps) {
  const scoped = useLoadingScope();
  // While the table flag is read the table draws its loading state too (and reads nothing): it never draws one layout
  // and swaps to the other.
  const { loading: flagLoading } = useGridTableProps(ARCHIVE_TABLE_KEY, { fill: true });
  if (scoped || flagLoading) {
    return (
      <LoadingWhen loading>
        <ArchivedArticlesRows {...props} rows={NO_ITEMS} totalCount={0} pager={null} />
      </LoadingWhen>
    );
  }
  return <ArchivedArticlesTableQuery {...props} />;
}

/**
 * The page the URL names, its footer and the auto-refresh. An archive, an unarchive, a folder deleted with its
 * articles archived or an archived article saved back changes which articles the page holds, which is the server's
 * answer: it marks the list changed and the page is read again (`useListRefreshEpoch`), keeping the rows on screen
 * until it arrives.
 */
function ArchivedArticlesTableQuery({ pager, pageVariables, ...props }: ArchivedArticlesTableProps) {
  const { search, tagIds, isPending } = props;
  const retryKey = useRetryKey();
  const changed = useListRefreshEpoch('archivedArticles');
  const variables: ArchivedArticlesTableQueryType['variables'] = {
    search: search || null,
    tagIds: tagIds.length > 0 ? [...tagIds] : null,
    ...forwardPage(pageVariables, KNOWLEDGE_BASE_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<ArchivedArticlesTableQueryType>(archivedArticlesTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${changed}`,
  });
  const refetch = useRefetchPage<ArchivedArticlesTableQueryType>(archivedArticlesTableQuery, variables);
  const { edges, pageInfo, filteredCount } = queryData.archivedArticles;
  // A top-level page: its auto-refresh interval has no prefix, as its other params.
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, refetch, isPending });

  return (
    <ArchivedArticlesRows
      {...props}
      rows={edges.map(edge => edge.node)}
      totalCount={filteredCount}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

interface ArchivedArticlesRowsProps extends Omit<ArchivedArticlesTableProps, 'pager' | 'pageVariables'> {
  rows: readonly ArchivedRow[];
  /** The server's total for the search and the tags, not the rows on the page. */
  totalCount: number;
  /** The First · Prev · Next pager (`usePagedTable`); `null` while the page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function ArchivedArticlesRows({
  rows,
  totalCount,
  pager,
  refresh,
  search,
  tagIds,
  isPending,
  stickyHeaderOffset,
}: ArchivedArticlesRowsProps) {
  const loading = useLoadingScope();
  // The new grid table, behind the app's one table flag; card rows while it is off. The list is the page's main
  // content, so in the grid it is the page's scroll area.
  const tableGrid = useGridTableProps(ARCHIVE_TABLE_KEY, { fill: true });
  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<ArchivedRow, 'unarchive'>();

  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<ArchivedRow>(KNOWLEDGE_BASE_PAGE_SIZE) : null),
    [loading],
  );
  const table = useDataTable<ArchivedRow>({
    // The table only ever reads the page it is handed.
    data: placeholderRows ?? (rows as ArchivedRow[]),
    columns: buildColumns(row => openDialog(row, 'unarchive')),
    getRowId,
    enableSorting: false,
  });

  const isNarrowed = search !== '' || tagIds.length > 0;

  return (
    <>
      <LiveTable
        table={table}
        pageSize={KNOWLEDGE_BASE_PAGE_SIZE}
        loadingCells={loading}
        totalCount={totalCount}
        itemName="article"
        emptyState={
          isNarrowed
            ? { title: 'No archived articles match your filters.' }
            : oneLineEmptyState('No archived articles.')
        }
        rowHref={rowHref}
        pager={pager}
        refresh={refresh}
        isPending={isPending}
        stickyHeaderOffset={stickyHeaderOffset}
        layout={tableGrid.layout}
        maxHeight={tableGrid.maxHeight}
        settings={tableGrid.settings}
      />

      {dialog && <UnarchiveArticleModal article={dialog.row} isOpen={dialog.isOpen} onClose={closeDialog} />}
    </>
  );
}
