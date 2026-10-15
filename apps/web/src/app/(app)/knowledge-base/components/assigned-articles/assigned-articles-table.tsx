'use client';

import { BookBookmarkIcon, Link01BreakIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect } from 'react';
import { ConnectionHandler, graphql, useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type { SelectorStoreUpdater } from 'relay-runtime';
import type {
  assignedArticlesTable_query$data,
  assignedArticlesTable_query$key,
} from '@/__generated__/assignedArticlesTable_query.graphql';
import type { assignedArticlesTablePaginationQuery as AssignedArticlesTablePaginationQueryType } from '@/__generated__/assignedArticlesTablePaginationQuery.graphql';
import type { assignedArticlesTableQuery as AssignedArticlesTableQueryType } from '@/__generated__/assignedArticlesTableQuery.graphql';
import type { assignedArticlesTableUnassignMutation as AssignedArticlesTableUnassignMutationType } from '@/__generated__/assignedArticlesTableUnassignMutation.graphql';
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { KnowledgeBaseItemCreatedCell } from '../item-list/knowledge-base-item-created-cell';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import { OpenItemButton } from '../shared/open-item-button';
import { type AssignedArticlesTarget, targetNoun } from './assigned-articles-target';

/**
 * The articles assigned to one customer or device, from every folder: drafts
 * included, archived left out, most recently updated first — all decided by the
 * server once `assignedTo` is set.
 */
const assignedArticlesTableQuery = graphql`
  query assignedArticlesTableQuery($filter: KnowledgeBaseFilterInput, $search: String, $first: Int!, $after: String) {
    ...assignedArticlesTable_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

const assignedArticlesTableFragment = graphql`
  fragment assignedArticlesTable_query on Query
  @refetchable(queryName: "assignedArticlesTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "KnowledgeBaseFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "assignedArticlesTable_knowledgeBaseItems", filters: ["filter", "search"]) {
      # Unassign takes the row out of this connection.
      __id
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

type ArticleRow = assignedArticlesTable_query$data['knowledgeBaseItems']['edges'][number]['node'];

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
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.created.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.created.header,
      cell: ({ row }: { row: Row<ArticleRow> }) => <KnowledgeBaseItemCreatedCell item={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.created),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<ArticleRow> }) => (
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
      ),
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.actions),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.open.id,
      cell: ({ row }: { row: Row<ArticleRow> }) => <OpenItemButton href={rowHref(row.original)} />,
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.open),
    },
  ];
}

export interface AssignedArticlesListing {
  search: string;
  tagIds: readonly string[];
}

interface AssignedArticlesTableProps {
  target: AssignedArticlesTarget;
  /** Deferred — feeds the query (lags the search box and the tag chips during a refetch). */
  listing: AssignedArticlesListing;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** Bumped after an assign or unassign: asks the server again from the top. */
  refreshKey: number;
  /** An unassign went through — the tab refreshes what depends on the set. */
  onChanged: () => void;
  /** Nothing assigned at all (not a search or tag miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The rows of the Assigned Articles tab — suspends on the query, so it lives under the tab's `<Suspense>`. */
export function AssignedArticlesTable({
  target,
  listing,
  isPending,
  refreshKey,
  onChanged,
  onEmptyChange,
  stickyHeaderOffset,
}: AssignedArticlesTableProps) {
  const { toast } = useToast();
  const retryKey = useRetryKey();

  const hasFilters = listing.search !== '' || listing.tagIds.length > 0;
  const variables: AssignedArticlesTableQueryType['variables'] = {
    filter: {
      assignedTo: { targetType: target.targetType, targetId: target.targetId },
      tagIds: listing.tagIds.length > 0 ? [...listing.tagIds] : null,
    },
    search: listing.search || null,
    first: KNOWLEDGE_BASE_PAGE_SIZE,
    after: null,
  };
  const queryData = useLazyLoadQuery<AssignedArticlesTableQueryType>(assignedArticlesTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${refreshKey}`,
  });

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    AssignedArticlesTablePaginationQueryType,
    assignedArticlesTable_query$key
  >(assignedArticlesTableFragment, queryData);
  const items = data.knowledgeBaseItems;
  const rows = items.edges.map(edge => edge.node);

  const [commitUnassign] = useMutation<AssignedArticlesTableUnassignMutationType>(
    assignedArticlesTableUnassignMutation,
  );

  const handleUnassign = (row: ArticleRow) => {
    const removeRow: SelectorStoreUpdater<AssignedArticlesTableUnassignMutationType['response']> = store => {
      const connection = store.get(items.__id);
      if (!connection) return;
      ConnectionHandler.deleteNode(connection, row.id);
      const count = connection.getValue('filteredCount');
      if (typeof count === 'number') connection.setValue(Math.max(0, count - 1), 'filteredCount');
    };
    commitUnassign({
      variables: { itemId: row.id, targetType: target.targetType, targetId: target.targetId },
      // The row leaves at once and stays gone (the response is a bare Boolean, so the
      // optimistic removal is replayed as the real one); `onChanged` then asks the
      // server for the list and the tags.
      optimisticUpdater: removeRow,
      updater: removeRow,
      onCompleted: () => {
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

  const table = useDataTable<ArticleRow>({
    data: rows,
    columns: buildColumns(handleUnassign),
    getRowId,
    enableSorting: false,
  });

  // A search or a tag filter that finds nothing keeps the table (its own "no
  // match" row); nothing assigned at all gets the tab's empty state instead.
  const showEmptyState = !hasFilters && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<BookBookmarkIcon />}
        title="No articles yet"
        description={`Articles assigned to this ${targetNoun(target)} will appear here.`}
      />
    );
  }

  return (
    // Dim (don't unmount) the stale rows while a deferred refetch is in flight.
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="article" totalCount={items.filteredCount} />}
        />
        <DataTable.Body
          emptyState={{
            title: listing.search
              ? `No articles found matching "${listing.search}". Try adjusting your search.`
              : 'No articles match the selected tags. Try adjusting your filters.',
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
  );
}
