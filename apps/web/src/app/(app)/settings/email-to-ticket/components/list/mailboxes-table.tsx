'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { MailboxIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useDataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { mailboxesTable_query$key } from '@/__generated__/mailboxesTable_query.graphql';
import type { mailboxesTablePaginationQuery as MailboxesTablePaginationQueryType } from '@/__generated__/mailboxesTablePaginationQuery.graphql';
import type {
  mailboxesTableQuery as MailboxesTableQueryType,
  mailboxesTableQuery$variables,
} from '@/__generated__/mailboxesTableQuery.graphql';
import { singleColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import {
  EmptyState,
  type InfiniteScroll,
  NO_ITEMS,
  NO_NEXT_PAGE,
  oneLineEmptyState,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { routes } from '@/lib/routes';
import { MAILBOX_COLUMNS, MAILBOX_TABLE_COLUMNS } from './mailbox-columns';
import { getMailboxRowId, type MailboxRow, mailboxRowHref, toMailboxRow } from './mailbox-row';

const MAILBOXES_PAGE_SIZE = 20;

const mailboxesTableQuery = graphql`
  query mailboxesTableQuery(
    $search: String
    $filter: MailboxFilterInput
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...mailboxesTable_query @arguments(search: $search, filter: $filter, sort: $sort, first: $first, after: $after)
  }
`;

// Active mailboxes only: the API never lists a Pending or a disconnected one (contract part A, `mailboxes`).
const mailboxesTableFragment = graphql`
  fragment mailboxesTable_query on Query
  @refetchable(queryName: "mailboxesTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    filter: { type: "MailboxFilterInput" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    mailboxes(search: $search, filter: $filter, sort: $sort, first: $first, after: $after)
      @connection(key: "mailboxesTable_mailboxes") {
      filteredCount
      edges {
        node {
          ...mailboxRow_mailbox
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export type MailboxesFilter = mailboxesTableQuery$variables['filter'];
export type MailboxesSort = mailboxesTableQuery$variables['sort'];

interface MailboxesTableProps {
  /** Deferred: they feed the query. */
  filter: MailboxesFilter;
  sort: MailboxesSort;
  debouncedSearch: string;
  /** Live: what the headers draw, so a tick or a click lands instantly. */
  statusSelection: readonly string[];
  onStatusSelectionChange: (next: string[]) => void;
  ticketsSort: 'asc' | 'desc' | null;
  onToggleTicketsSort: () => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** No mailbox at all (not a search or funnel miss): the view drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The Mailboxes rows, with their own boundary: in its scope the reader draws placeholder rows and does not fetch. */
export function MailboxesTable(props: MailboxesTableProps) {
  return (
    <LoadingSuspense label="Loading mailboxes">
      <MailboxesTableReader {...props} />
    </LoadingSuspense>
  );
}

function MailboxesTableReader(props: MailboxesTableProps) {
  if (useLoadingScope()) {
    return <MailboxesRows {...props} rows={NO_ITEMS} totalCount={0} infiniteScroll={NO_NEXT_PAGE} />;
  }
  return <MailboxesTableQuery {...props} />;
}

function MailboxesTableQuery(props: MailboxesTableProps) {
  const { filter, sort, debouncedSearch } = props;
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<MailboxesTableQueryType>(
    mailboxesTableQuery,
    { search: debouncedSearch || null, filter, sort, first: MAILBOXES_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    MailboxesTablePaginationQueryType,
    mailboxesTable_query$key
  >(mailboxesTableFragment, queryData);

  const { edges, filteredCount } = data.mailboxes;
  const rows = useMemo(() => edges.map(({ node }) => toMailboxRow(node)), [edges]);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(MAILBOXES_PAGE_SIZE);
  };
  return (
    <MailboxesRows
      {...props}
      rows={rows}
      totalCount={filteredCount}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

function MailboxesRows({
  rows,
  totalCount,
  infiniteScroll,
  filter,
  debouncedSearch,
  statusSelection,
  onStatusSelectionChange,
  ticketsSort,
  onToggleTicketsSort,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: MailboxesTableProps & { rows: readonly MailboxRow[]; totalCount: number; infiniteScroll: InfiniteScroll }) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('email-to-ticket-mailboxes');
  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    MAILBOX_COLUMNS.status.id,
    statusSelection,
    onStatusSelectionChange,
  );
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<MailboxRow>(MAILBOXES_PAGE_SIZE) : null),
    [loading],
  );
  const table = useDataTable<MailboxRow>({
    data: placeholderRows ?? (rows as MailboxRow[]),
    columns: MAILBOX_TABLE_COLUMNS,
    getRowId: getMailboxRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table; no mailbox at all gets the page's empty state.
  const showEmptyState = !loading && !debouncedSearch && !filter && !isPending && rows.length === 0;
  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<MailboxIcon />}
        title="No mailboxes connected yet"
        description="Connect a support mailbox: the emails forwarded from it become tickets."
        buttonLabel="Connect mailbox"
        buttonProps={{ href: routes.settings.emailToTicket.new() }}
      />
    );
  }
  return (
    <LiveTable
      {...tableGrid}
      table={table}
      pageSize={MAILBOXES_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      isPending={isPending}
      sort={ticketsSort ? { id: MAILBOX_COLUMNS.tickets.id, desc: ticketsSort === 'desc' } : null}
      onSortChange={onToggleTicketsSort}
      emptyState={oneLineEmptyState(
        debouncedSearch
          ? `No mailboxes found matching "${debouncedSearch}". Try adjusting your search.`
          : 'No mailboxes match the selected status. Try adjusting your filters.',
      )}
      rowHref={mailboxRowHref}
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}
