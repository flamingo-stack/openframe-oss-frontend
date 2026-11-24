'use client';

import { MailboxIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useDataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import type { mailboxesTableQuery$variables } from '@/__generated__/mailboxesTableQuery.graphql';
import { singleColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { EmptyState, type InfiniteScroll, oneLineEmptyState } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { routes } from '@/lib/routes';
import { MAILBOX_COLUMNS, MAILBOX_TABLE_COLUMNS } from './mailbox-columns';
import { getMailboxRowId, type MailboxRow, mailboxRowHref } from './mailbox-row';

export const MAILBOXES_PAGE_SIZE = 20;

export type MailboxesFilter = mailboxesTableQuery$variables['filter'];
export type MailboxesSort = mailboxesTableQuery$variables['sort'];

interface MailboxesRowsProps {
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
  rows: readonly MailboxRow[];
  totalCount: number;
  infiniteScroll: InfiniteScroll;
}

/** The Mailboxes table, or the page's empty state when there is no mailbox at all. */
export function MailboxesRows({
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
}: MailboxesRowsProps) {
  const loading = useLoadingScope();
  const tableGrid = useTableGrid('email-to-ticket-mailboxes');
  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    MAILBOX_COLUMNS.status.id,
    statusSelection,
    onStatusSelectionChange,
  );
  const table = useDataTable<MailboxRow>({
    data: loading ? loadingPlaceholderRows<MailboxRow>(MAILBOXES_PAGE_SIZE) : (rows as MailboxRow[]),
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
