'use client';

import {
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  archivedArticlesTable_query$data,
  archivedArticlesTable_query$key,
} from '@/__generated__/archivedArticlesTable_query.graphql';
import type { archivedArticlesTablePaginationQuery as ArchivedArticlesTablePaginationQueryType } from '@/__generated__/archivedArticlesTablePaginationQuery.graphql';
import type { archivedArticlesTableQuery as ArchivedArticlesTableQueryType } from '@/__generated__/archivedArticlesTableQuery.graphql';
import { liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { routes } from '@/lib/routes';
import { UnarchiveArticleModal } from '../dialogs/unarchive-article-modal';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import { OpenItemButton } from '../shared/open-item-button';
import { useRowDialog } from '../shared/use-row-dialog';
import { ArchivedArticleActionsCell } from './archived-article-actions-cell';
import { ArchivedArticleDateCell } from './archived-article-date-cell';
import { ARCHIVED_COLUMN } from './archived-articles-columns';

/** Every archived article of the knowledge base, whichever folder it was archived from — newest first. */
const archivedArticlesTableQuery = graphql`
  query archivedArticlesTableQuery($search: String, $tagIds: [ID], $first: Int!, $after: String) {
    ...archivedArticlesTable_query @arguments(search: $search, tagIds: $tagIds, first: $first, after: $after)
  }
`;

const archivedArticlesTableFragment = graphql`
  fragment archivedArticlesTable_query on Query
  @refetchable(queryName: "archivedArticlesTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    tagIds: { type: "[ID]" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    archivedArticles(search: $search, tagIds: $tagIds, first: $first, after: $after)
      @connection(key: "archivedArticlesTable_archivedArticles", filters: ["search", "tagIds"]) {
      # A restored article leaves this listing at once.
      __id
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
        endCursor
      }
    }
  }
`;

type ArchivedRow = archivedArticlesTable_query$data['archivedArticles']['edges'][number]['node'];

const getRowId = (row: ArchivedRow) => row.id;
const rowHref = (row: ArchivedRow) => routes.knowledgeBase.details(row.id);

function buildColumns(onUnarchive: (row: ArchivedRow) => void): ColumnDef<ArchivedRow>[] {
  return [
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
      cell: ({ row }: { row: Row<ArchivedRow> }) => <KnowledgeBaseItemNameCell item={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name),
    },
    {
      id: ARCHIVED_COLUMN.id,
      header: ARCHIVED_COLUMN.header,
      cell: ({ row }: { row: Row<ArchivedRow> }) => <ArchivedArticleDateCell article={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(ARCHIVED_COLUMN),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<ArchivedRow> }) => (
        <ArchivedArticleActionsCell onUnarchive={() => onUnarchive(row.original)} />
      ),
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.actions),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.open.id,
      cell: ({ row }: { row: Row<ArchivedRow> }) => <OpenItemButton href={rowHref(row.original)} />,
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.open),
    },
  ];
}

interface ArchivedArticlesTableProps {
  /** Deferred — feeds the query (lags the search box during a refetch). */
  search: string;
  /** Deferred — feeds the query (lags the tag chips during a refetch). */
  tagIds: readonly string[];
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
}

/** The archive's rows — suspends on the query, so it lives under the view's `<Suspense>`. */
export function ArchivedArticlesTable({ search, tagIds, isPending, stickyHeaderOffset }: ArchivedArticlesTableProps) {
  const { toast } = useToast();
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<ArchivedArticlesTableQueryType>(
    archivedArticlesTableQuery,
    {
      search: search || null,
      tagIds: tagIds.length > 0 ? [...tagIds] : null,
      first: KNOWLEDGE_BASE_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ArchivedArticlesTablePaginationQueryType,
    archivedArticlesTable_query$key
  >(archivedArticlesTableFragment, queryData);
  const archived = data.archivedArticles;
  const rows = archived.edges.map(edge => edge.node);

  const fetchNextPage = () => {
    if (!hasNext || isLoadingNext) return;
    loadNext(KNOWLEDGE_BASE_PAGE_SIZE, {
      onComplete: error => {
        if (error) {
          toast({ title: 'Error loading more articles', description: error.message, variant: 'destructive' });
        }
      },
    });
  };

  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<ArchivedRow, 'unarchive'>();

  const table = useDataTable<ArchivedRow>({
    data: rows,
    columns: buildColumns(row => openDialog(row, 'unarchive')),
    getRowId,
    enableSorting: false,
  });

  const isNarrowed = search !== '' || tagIds.length > 0;

  return (
    <>
      {/* Dim (don't unmount) the stale rows while a deferred refetch is in flight. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={<DataTable.RowCount itemName="article" totalCount={archived.filteredCount} />}
          />
          <DataTable.Body
            emptyState={{
              title: isNarrowed ? 'No archived articles match your filters.' : 'No archived articles.',
            }}
            rowClassName="mb-1"
            rowHref={rowHref}
          />
          {rows.length > 0 && (
            <DataTable.InfiniteFooter
              hasNextPage={hasNext}
              isFetchingNextPage={isLoadingNext}
              onLoadMore={fetchNextPage}
              skeletonRows={2}
            />
          )}
        </DataTable>
      </div>

      {dialog && (
        <UnarchiveArticleModal
          article={dialog.row}
          isOpen={dialog.isOpen}
          onClose={closeDialog}
          listingIds={[archived.__id]}
        />
      )}
    </>
  );
}
