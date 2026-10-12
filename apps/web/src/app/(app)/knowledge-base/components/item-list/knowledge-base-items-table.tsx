'use client';

import { BookBookmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect } from 'react';
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useRelayEnvironment,
  useSubscribeToInvalidationState,
} from 'react-relay';
import type {
  knowledgeBaseItemsTable_query$data,
  knowledgeBaseItemsTable_query$key,
} from '@/__generated__/knowledgeBaseItemsTable_query.graphql';
import type { knowledgeBaseItemsTablePaginationQuery as KnowledgeBaseItemsTablePaginationQueryType } from '@/__generated__/knowledgeBaseItemsTablePaginationQuery.graphql';
import type { knowledgeBaseItemsTableQuery as KnowledgeBaseItemsTableQueryType } from '@/__generated__/knowledgeBaseItemsTableQuery.graphql';
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { ROOT_FOLDER } from '../shared/folder-tree';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { knowledgeBaseItemHref } from '../shared/knowledge-base-item-href';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import {
  isSubtreeListing,
  type KnowledgeBaseListing,
  knowledgeBaseListingArgs,
} from '../shared/knowledge-base-listings';
import { OpenItemButton } from '../shared/open-item-button';
import { useRowDialog } from '../shared/use-row-dialog';
import { type ItemDialogKind, KnowledgeBaseItemActionsCell } from './knowledge-base-item-actions-cell';
import { KnowledgeBaseItemCreatedCell } from './knowledge-base-item-created-cell';
import { KnowledgeBaseItemDialogs } from './knowledge-base-item-dialogs';

/**
 * One level of the knowledge base — the root or a folder — as ONE paged list:
 * folders first, by name, then articles, newest change first. Browsing lists the
 * level itself; a search or a tag filter goes to the server and lists everything
 * under the level, at any depth.
 */
const knowledgeBaseItemsTableQuery = graphql`
  query knowledgeBaseItemsTableQuery($filter: KnowledgeBaseFilterInput, $search: String, $first: Int!, $after: String) {
    ...knowledgeBaseItemsTable_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

const knowledgeBaseItemsTableFragment = graphql`
  fragment knowledgeBaseItemsTable_query on Query
  @refetchable(queryName: "knowledgeBaseItemsTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "KnowledgeBaseFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "knowledgeBaseItemsTable_knowledgeBaseItems", filters: ["filter", "search"]) {
      # The row dialogs take a row out of this listing, and a listing marked
      # stale is refetched below.
      __id
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
        endCursor
      }
    }
  }
`;

type ItemRow = knowledgeBaseItemsTable_query$data['knowledgeBaseItems']['edges'][number]['node'];

const getRowId = (row: ItemRow) => row.id;
const rowHref = (row: ItemRow) => knowledgeBaseItemHref(row.type, row.id);

function buildColumns(
  isSubtree: boolean,
  onOpenDialog: (row: ItemRow, dialog: ItemDialogKind) => void,
): ColumnDef<ItemRow>[] {
  return [
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
      cell: ({ row }: { row: Row<ItemRow> }) => (
        <KnowledgeBaseItemNameCell
          item={row.original}
          folder={isSubtree ? (row.original.parent?.name ?? ROOT_FOLDER.name) : undefined}
        />
      ),
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.name),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.created.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.created.header,
      cell: ({ row }: { row: Row<ItemRow> }) => <KnowledgeBaseItemCreatedCell item={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.created),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<ItemRow> }) => (
        <KnowledgeBaseItemActionsCell item={row.original} onOpen={dialog => onOpenDialog(row.original, dialog)} />
      ),
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.actions),
    },
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.open.id,
      cell: ({ row }: { row: Row<ItemRow> }) => <OpenItemButton href={rowHref(row.original)} />,
      enableSorting: false,
      meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.open),
    },
  ];
}

interface KnowledgeBaseItemsTableProps {
  /** Deferred — feeds the query (lags the search box and the tag chips during a refetch). */
  listing: KnowledgeBaseListing;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** Nothing on this level at all (not a search or tag miss) — the view drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The rows of a knowledge base level — suspends on the query, so it lives under the view's `<Suspense>`. */
export function KnowledgeBaseItemsTable({
  listing,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: KnowledgeBaseItemsTableProps) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();

  const variables: KnowledgeBaseItemsTableQueryType['variables'] = {
    ...knowledgeBaseListingArgs(listing),
    first: KNOWLEDGE_BASE_PAGE_SIZE,
    after: null,
  };
  const queryData = useLazyLoadQuery<KnowledgeBaseItemsTableQueryType>(knowledgeBaseItemsTableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    KnowledgeBaseItemsTablePaginationQueryType,
    knowledgeBaseItemsTable_query$key
  >(knowledgeBaseItemsTableFragment, queryData);
  const items = data.knowledgeBaseItems;

  // A mutation marked this listing stale — a folder created on this level, an
  // item moved into it or within a search result. Asking again from the top is
  // the only way to learn what the server lists now, and where.
  useSubscribeToInvalidationState([items.__id], () => {
    fetchQuery(environment, knowledgeBaseItemsTableQuery, variables, { fetchPolicy: 'network-only' }).subscribe({});
  });

  const rows = items.edges.map(edge => edge.node);

  const fetchNextPage = () => {
    if (!hasNext || isLoadingNext) return;
    loadNext(KNOWLEDGE_BASE_PAGE_SIZE, {
      onComplete: error => {
        if (error) {
          toast({ title: 'Error loading more items', description: error.message, variant: 'destructive' });
        }
      },
    });
  };

  const { dialog, open: openDialog, close: closeDialog } = useRowDialog<ItemRow, ItemDialogKind>();

  const isSubtree = isSubtreeListing(listing);
  const table = useDataTable<ItemRow>({
    data: rows,
    columns: buildColumns(isSubtree, openDialog),
    getRowId,
    enableSorting: false,
  });

  // A search or a tag filter that finds nothing keeps the table (its own "no
  // match" row); a level with nothing on it gets the page's empty state instead.
  const showEmptyState = !isSubtree && !isPending && rows.length === 0;

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
        // Dim (don't unmount) the stale rows while a deferred refetch is in flight.
        <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
          <DataTable table={table}>
            <DataTable.Header
              stickyHeader
              stickyHeaderOffset={stickyHeaderOffset}
              rightSlot={<DataTable.RowCount itemName="item" totalCount={items.filteredCount} />}
            />
            <DataTable.Body
              emptyState={{
                title: listing.search
                  ? `No articles or folders found matching "${listing.search}". Try adjusting your search.`
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
      )}

      {/* Outside both branches: deleting the last row swaps the table for the empty state mid-dialog. */}
      {dialog && (
        <KnowledgeBaseItemDialogs
          item={dialog.row}
          kind={dialog.kind}
          isOpen={dialog.isOpen}
          onClose={closeDialog}
          listingIds={[items.__id]}
        />
      )}
    </>
  );
}
