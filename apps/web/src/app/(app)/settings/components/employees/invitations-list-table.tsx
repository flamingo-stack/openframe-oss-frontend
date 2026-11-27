'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { CursorPagerVariables, UseCursorPagerReturn } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { invitationsListTableQuery } from '@/__generated__/invitationsListTableQuery.graphql';
import { NO_ITEMS, useRetryKey } from '@/app/components/shared';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { useListRefreshEpoch } from '@/lib/list-refresh';
import {
  type EmployeeSelections,
  invitationFilterOptions,
  NO_EMPLOYEE_FILTER_OPTIONS,
  toInvitationFilter,
} from './employee-filters';
import { INVITATIONS_PAGE_SIZE } from './employees-columns';
import { InvitationsTable } from './invitations-table';

/**
 * One page of open invitations per request, its cursor in the URL (`cursor`; no `@connection`: a cursor from a link
 * must read exactly its page). `invitations` pages forward only (`first` / `after`). The funnels' counts ride along: a
 * page move asks for them again with the same scope (the same answer).
 */
const invitationsListTableQueryNode = graphql`
  query invitationsListTableQuery($filter: InvitationFilterInput, $search: String, $first: Int!, $after: String) {
    invitations(filter: $filter, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          ...invitationsTable_invitation
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
    invitationFilters(filter: $filter, search: $search) {
      ...employeeFilters_invitationFilters
    }
  }
`;

interface InvitationsListTableProps {
  search: string;
  /** Deferred funnels — feed the query (lag the live ones during a refetch). */
  backendSelections: EmployeeSelections;
  /** Live funnels — what the headers draw as ticked, so a tick lands instantly. */
  selections: EmployeeSelections;
  onSelectionsChange: (next: EmployeeSelections) => void;
  /** A deferred search or funnel lags its control: the rows on screen are the previous result. */
  isPending: boolean;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * Open invitations, newest first, searched, narrowed and paged on the server (First · Prev · Next), with their own
 * boundary. In a loading scope (the boundary's fallback) the reader draws the table over one page of placeholder rows
 * with their real cells; otherwise it runs the query, which suspends under that boundary. A cursor the server refuses
 * drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 *
 * The table's layout is the app's one table flag: the grid where it is on, card rows where it is off. Until the flag
 * is answered the list is a loading scope, so one table is never drawn and then replaced by the other.
 */
export function InvitationsListTable(props: InvitationsListTableProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <InvitationsListTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function InvitationsListTableLoading(props: InvitationsListTableProps) {
  return (
    <LoadingSuspense label="Loading invitations">
      <InvitationsListGate {...props} />
    </LoadingSuspense>
  );
}

/**
 * Reads the app's table flag under the boundary, so the boundary's fallback and the read rows draw the same layout.
 * Until the flag is answered the reader below is in a loading scope: it draws its loading form and does not fetch.
 */
function InvitationsListGate(props: InvitationsListTableProps) {
  const tableGate = useTableGridGate();
  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <InvitationsListReader {...props} layout={tableLayoutFor(tableGate)} />
    </LoadingWhen>
  );
}

/** What the reader and the query take: the listing's props and the layout both of their tables draw. */
type InvitationsListReaderProps = InvitationsListTableProps & { layout: TableLayout };

function InvitationsListReader(props: InvitationsListReaderProps) {
  if (useLoadingScope()) {
    return (
      <InvitationsTable
        rows={NO_ITEMS}
        totalCount={0}
        search={props.search}
        isFiltered={false}
        filterOptions={NO_EMPLOYEE_FILTER_OPTIONS}
        selections={props.selections}
        onSelectionsChange={props.onSelectionsChange}
        isPending={false}
        stickyHeaderOffset={props.stickyHeaderOffset}
        pager={null}
        layout={props.layout}
      />
    );
  }
  return <InvitationsListQuery {...props} />;
}

/**
 * The page the URL names, its footer and the auto-refresh. An invite, a revoke or a resend changes which invitations
 * the page holds and the funnels' numbers, which is the server's answer: the dialog marks the list changed and the
 * page is read again (`useListRefreshEpoch`), keeping the rows on screen until it arrives.
 */
function InvitationsListQuery({
  search,
  backendSelections,
  selections,
  onSelectionsChange,
  isPending,
  stickyHeaderOffset,
  layout,
  pager,
  pageVariables,
}: InvitationsListReaderProps) {
  const retryKey = useRetryKey();
  const changed = useListRefreshEpoch('invitations');
  const filter = toInvitationFilter(backendSelections);
  const variables = { filter, search: search || null, ...forwardPage(pageVariables, INVITATIONS_PAGE_SIZE) };
  const queryData = useLazyLoadQuery<invitationsListTableQuery>(invitationsListTableQueryNode, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: `${retryKey}:${changed}`,
  });
  const refetch = useRefetchPage<invitationsListTableQuery>(invitationsListTableQueryNode, variables);
  const { edges, pageInfo, filteredCount } = queryData.invitations;
  // A top-level page: its auto-refresh interval has no prefix, as its other params.
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, refetch, isPending });

  return (
    <InvitationsTable
      rows={edges.map(edge => edge.node)}
      totalCount={filteredCount}
      search={search}
      isFiltered={filter !== null}
      filterOptions={invitationFilterOptions(queryData.invitationFilters, selections)}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
      layout={layout}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}
