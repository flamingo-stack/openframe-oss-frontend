'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentProps } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { mailboxesTable_query$key } from '@/__generated__/mailboxesTable_query.graphql';
import type { mailboxesTablePaginationQuery as MailboxesTablePaginationQueryType } from '@/__generated__/mailboxesTablePaginationQuery.graphql';
import type { mailboxesTableQuery as MailboxesTableQueryType } from '@/__generated__/mailboxesTableQuery.graphql';
import { NO_ITEMS, NO_NEXT_PAGE, useRetryKey } from '@/app/components/shared';
import { toMailboxRow } from './mailbox-row';
import { MAILBOXES_PAGE_SIZE, MailboxesRows } from './mailboxes-rows';

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

type MailboxesTableProps = Omit<ComponentProps<typeof MailboxesRows>, 'page'>;

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
    return <MailboxesRows {...props} page={{ rows: NO_ITEMS, totalCount: 0, infiniteScroll: NO_NEXT_PAGE }} />;
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
  const rows = edges.map(({ node }) => toMailboxRow(node));

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(MAILBOXES_PAGE_SIZE);
  };
  return (
    <MailboxesRows
      {...props}
      page={{
        rows,
        totalCount: filteredCount,
        infiniteScroll: { hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage },
      }}
    />
  );
}
