'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useDataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { blockListTable_query$key } from '@/__generated__/blockListTable_query.graphql';
import type { blockListTablePaginationQuery as BlockListTablePaginationQueryType } from '@/__generated__/blockListTablePaginationQuery.graphql';
import type { blockListTableQuery as BlockListTableQueryType } from '@/__generated__/blockListTableQuery.graphql';
import { type InfiniteScroll, NO_ITEMS, NO_NEXT_PAGE, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { BLOCK_LIST_TABLE_COLUMNS } from './block-list-columns';
import { type BlockListEntryRow, getBlockListEntryRowId, toBlockListEntryRow } from './block-list-entry-row';

export const BLOCK_LIST_PAGE_SIZE = 20;

const blockListTableQuery = graphql`
  query blockListTableQuery($mailboxId: ID!, $first: Int!, $after: String) {
    ...blockListTable_query @arguments(mailboxId: $mailboxId, first: $first, after: $after)
  }
`;

// Newest first (contract part D, `emailBlockList`).
const blockListTableFragment = graphql`
  fragment blockListTable_query on Query
  @refetchable(queryName: "blockListTablePaginationQuery")
  @argumentDefinitions(
    mailboxId: { type: "ID!" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    emailBlockList(mailboxId: $mailboxId, first: $first, after: $after)
      @connection(key: "blockListTable_emailBlockList", filters: ["mailboxId"]) {
      filteredCount
      edges {
        node {
          ...blockListEntryRow_entry
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** A mailbox's Block list, read-only, with its own boundary: in its scope it draws placeholder rows and does not fetch. */
export function BlockListTable({ mailboxId }: { mailboxId: string }) {
  return (
    <LoadingSuspense label="Loading block list">
      <BlockListTableReader mailboxId={mailboxId} />
    </LoadingSuspense>
  );
}

function BlockListTableReader({ mailboxId }: { mailboxId: string }) {
  if (useLoadingScope()) return <BlockListRows rows={NO_ITEMS} totalCount={0} infiniteScroll={NO_NEXT_PAGE} />;
  return <BlockListTableQuery mailboxId={mailboxId} />;
}

function BlockListTableQuery({ mailboxId }: { mailboxId: string }) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<BlockListTableQueryType>(
    blockListTableQuery,
    { mailboxId, first: BLOCK_LIST_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    BlockListTablePaginationQueryType,
    blockListTable_query$key
  >(blockListTableFragment, queryData);
  const { edges, filteredCount } = data.emailBlockList;
  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(BLOCK_LIST_PAGE_SIZE);
  };
  return (
    <BlockListRows
      rows={edges.map(({ node }) => toBlockListEntryRow(node))}
      totalCount={filteredCount}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

interface BlockListRowsProps {
  rows: readonly BlockListEntryRow[];
  totalCount: number;
  infiniteScroll: InfiniteScroll;
}

function BlockListRows({ rows, totalCount, infiniteScroll }: BlockListRowsProps) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('email-to-ticket-block-list');
  const table = useDataTable<BlockListEntryRow>({
    data: loading ? loadingPlaceholderRows<BlockListEntryRow>(BLOCK_LIST_PAGE_SIZE) : (rows as BlockListEntryRow[]),
    columns: BLOCK_LIST_TABLE_COLUMNS,
    getRowId: getBlockListEntryRowId,
    enableSorting: false,
  });
  return (
    <LiveTable
      {...tableGrid}
      table={table}
      pageSize={BLOCK_LIST_PAGE_SIZE}
      loadingCells={loading}
      stickyHeader={false}
      itemName="result"
      totalCount={totalCount}
      emptyState={oneLineEmptyState('No senders are blocked. Add them in Edit Mailbox.')}
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}
