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
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { KNOWLEDGE_BASE_ITEM_COLUMNS, KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { knowledgeBaseItemHref } from '../shared/knowledge-base-item-href';
import { KnowledgeBaseItemNameCell } from '../shared/knowledge-base-item-name-cell';
import { type KnowledgeBaseListing, knowledgeBaseListingArgs } from '../shared/knowledge-base-listings';
import { OpenItemButton } from '../shared/open-item-button';
import { useRowDialog } from '../shared/use-row-dialog';
import { type ItemDialogKind, KnowledgeBaseItemActionsCell } from './knowledge-base-item-actions-cell';
import { KnowledgeBaseItemCreatedCell } from './knowledge-base-item-created-cell';
import { KnowledgeBaseItemDialogs } from './knowledge-base-item-dialogs';

/**
 * One level of the knowledge base — the root or a folder — as ONE paged list:
 * its folders first, by name, then its articles, newest change first. Search
 * and the tag filter go to the server.
 */
const knowledgeBaseItemsTableQuery = graphql`
  query knowledgeBaseItemsTableQuery(
    $filter: KnowledgeBaseFilterInput
    $search: String
    $first: Int!
    $after: String
    $folderFilter: KnowledgeBaseFilterInput
    $searching: Boolean!
  ) {
    ...knowledgeBaseItemsTable_query @arguments(filter: $filter, search: $search, first: $first, after: $after)

    # TODO(oss-lib#2545): delete this field, its two variables and the merge in
    # the component. Before that backend a search lists articles only, so the
    # folders matching it are asked for apart. Once it is out the listing above
    # carries them and this answer is a subset of it.
    searchFolders: knowledgeBaseItems(filter: $folderFilter, search: $search, first: $first)
      @include(if: $searching)
      @connection(key: "knowledgeBaseItemsTable_searchFolders", filters: ["filter", "search"]) {
      __id
      edges {
        node {
          id
          type
          ...knowledgeBaseItemNameCell_item
          ...knowledgeBaseItemCreatedCell_item
          ...knowledgeBaseItemActionsCell_item
          ...knowledgeBaseItemDialogs_item
        }
      }
    }
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

function buildColumns(onOpenDialog: (row: ItemRow, dialog: ItemDialogKind) => void): ColumnDef<ItemRow>[] {
  return [
    {
      id: KNOWLEDGE_BASE_ITEM_COLUMNS.name.id,
      header: KNOWLEDGE_BASE_ITEM_COLUMNS.name.header,
      cell: ({ row }: { row: Row<ItemRow> }) => <KnowledgeBaseItemNameCell item={row.original} />,
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

  const { filter, search } = knowledgeBaseListingArgs(listing);
  const variables: KnowledgeBaseItemsTableQueryType['variables'] = {
    filter,
    search,
    first: KNOWLEDGE_BASE_PAGE_SIZE,
    after: null,
    folderFilter: { ...filter, type: KnowledgeBaseItemType.FOLDER },
    searching: search !== null,
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

  // A mutation elsewhere marked this listing stale — a folder created on this
  // level, an article moved into it (`invalidateFolderListing`). Asking again
  // from the top is the only way to learn where the server sorts the newcomer.
  useSubscribeToInvalidationState([items.__id], () => {
    fetchQuery(environment, knowledgeBaseItemsTableQuery, variables, { fetchPolicy: 'network-only' }).subscribe({});
  });

  const listed = items.edges.map(edge => edge.node);
  // TODO(oss-lib#2545): `rows` is `listed`, the count is `filteredCount` and the
  // listing ids are the one `__id` — see `searchFolders` in the query. Folders
  // the listing already holds are dropped here, so the two backends draw the
  // same list and neither draws a folder twice.
  const searchFolders = queryData.searchFolders;
  const listedIds = new Set(listed.map(row => row.id));
  const unlistedFolders = (searchFolders?.edges ?? []).map(edge => edge.node).filter(row => !listedIds.has(row.id));
  const rows: ItemRow[] = [...unlistedFolders, ...listed];
  const totalCount = items.filteredCount + unlistedFolders.length;
  const listingIds = searchFolders ? [items.__id, searchFolders.__id] : [items.__id];

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

  const table = useDataTable<ItemRow>({
    data: rows,
    columns: buildColumns(openDialog),
    getRowId,
    enableSorting: false,
  });

  // A search or a tag filter that finds nothing keeps the table (its own "no
  // match" row); a level with nothing on it gets the page's empty state instead.
  const isNarrowed = listing.search !== '' || listing.tagIds.length > 0;
  const showEmptyState = !isNarrowed && !isPending && rows.length === 0;

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
              rightSlot={<DataTable.RowCount itemName="item" totalCount={totalCount} />}
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
          listingIds={listingIds}
        />
      )}
    </>
  );
}
