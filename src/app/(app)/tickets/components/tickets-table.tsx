'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnFiltersState,
  DataTable,
  type OnChangeFn,
  PageError,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { useSelfFirstAssigneeOptions } from '../hooks/use-ticket-options';
import { emphasizeNewTicketAction, useTicketsActions } from '../hooks/use-tickets-actions';
import { useTicketsQuery } from '../hooks/use-tickets-query';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import type { Dialog } from '../types/dialog.types';
import type { StatusOption } from './status-autocomplete';
import { type StatusFilterOption, TicketTableBody } from './ticket-table-columns';
import { TicketTagFilter } from './ticket-tag-filter';
import { TicketsEmptyState } from './tickets-empty-state';
import { TicketsFilterModal } from './tickets-filter-modal';

// Per-row unread count comes from the ticket entity itself (`Ticket.unreadNotificationCount`).
// Viewing a ticket's client chat marks its notifications read (`useMarkEntityNotificationsRead`),
// clearing the badge in lockstep with the drawer and the sidebar nav count.
const getUnreadCount = (ticket: Dialog) => ticket.unreadNotificationCount;

interface TicketsTableProps {
  isArchived: boolean;
  statusFilters?: string[];
  organizationIds?: string[];
  assigneeIds?: string[];
  /**
   * Applies status/assignee/customer atomically in ONE call — the values are
   * URL params, and two sequential writes would clobber each other. Fired by
   * the column-header filters (md+) and the mobile Filter Tickets modal alike.
   */
  onFiltersChange?: (filters: { status: string[]; assigneeIds: string[]; organizationIds: string[] }) => void;
  backButton?: { label?: string; onClick: () => void };
  selector?: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  tagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
}

export function TicketsTable({
  isArchived,
  statusFilters,
  organizationIds,
  assigneeIds,
  onFiltersChange,
  backButton,
  selector,
  search,
  onSearchChange,
  tagIds,
  onTagIdsChange,
}: TicketsTableProps) {
  const debouncedSearch = useDebounce(search, 300);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const {
    dialogs: tickets,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useTicketsQuery({
    archived: isArchived,
    search: debouncedSearch,
    statusFilters,
    organizationIds,
    assigneeIds,
    tagIds,
  });

  const archiveFilter = useMemo(() => ({ tagIds }), [tagIds]);
  const {
    actions: baseActions,
    menuActions,
    dialog: ticketsActionsDialog,
  } = useTicketsActions({ isLoading, enabled: !isArchived, filter: archiveFilter });

  // Status filter options (value = status id).
  const statusesQuery = useTicketStatusesQuery({ enabled: !isArchived });
  const statusOptions = useMemo<StatusFilterOption[] | undefined>(() => {
    if (isArchived) return undefined;
    return (statusesQuery.data?.snapshot ?? [])
      .filter(s => s.kind !== 'ARCHIVED')
      .map(s => ({ id: s.id, value: s.id, label: s.name }));
  }, [isArchived, statusesQuery.data]);

  // The same statuses for the mobile modal's dropdown, with the color swatch.
  const statusModalOptions = useMemo<StatusOption[]>(() => {
    if (isArchived) return [];
    return (statusesQuery.data?.snapshot ?? [])
      .filter(s => s.kind !== 'ARCHIVED')
      .map(s => ({ value: s.id, label: s.name, color: s.color }));
  }, [isArchived, statusesQuery.data]);

  // Assignee filter options (value = user id) for the ASSIGNEE column header —
  // the same list the board's Assignee autocomplete shows, flattened.
  const assigneeOptionsQuery = useSelfFirstAssigneeOptions(!isArchived);
  const assigneeOptions = useMemo<StatusFilterOption[] | undefined>(() => {
    if (isArchived) return undefined;
    return assigneeOptionsQuery.options.map(option => ({
      id: String(option.value),
      value: String(option.value),
      label: option.label,
    }));
  }, [isArchived, assigneeOptionsQuery.options]);

  const handleFetchNextPage = useCallback(() => fetchNextPage(), [fetchNextPage]);

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (statusFilters && statusFilters.length > 0) filters.push({ id: 'status', value: statusFilters });
    if (assigneeIds && assigneeIds.length > 0) filters.push({ id: 'assignee', value: assigneeIds });
    return filters;
  }, [statusFilters, assigneeIds]);

  const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updater => {
      if (isArchived) return;
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      onFiltersChange?.({
        status: (next.find(f => f.id === 'status')?.value as string[] | undefined) ?? [],
        assigneeIds: (next.find(f => f.id === 'assignee')?.value as string[] | undefined) ?? [],
        // The header has no customer filter — carry the current value through.
        organizationIds: organizationIds ?? [],
      });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [columnFilters, isArchived, onFiltersChange, organizationIds],
  );

  const handleModalApply = useCallback(
    (filters: { organizationIds: string[]; assigneeIds: string[]; status?: string[] }) => {
      if (isArchived) return;
      onFiltersChange?.({
        status: filters.status ?? [],
        assigneeIds: filters.assigneeIds,
        organizationIds: filters.organizationIds,
      });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [isArchived, onFiltersChange],
  );

  const title = isArchived ? 'Archived Tickets' : 'Tickets';
  const emptyMessage = isArchived
    ? 'No archived tickets found. Try adjusting your search or filters.'
    : 'No tickets found. Try adjusting your search or filters.';

  const hasMobileFilter = !isArchived;

  const showEmptyState =
    !isLoading &&
    !debouncedSearch &&
    (statusFilters?.length ?? 0) === 0 &&
    (organizationIds?.length ?? 0) === 0 &&
    (assigneeIds?.length ?? 0) === 0 &&
    tagIds.length === 0 &&
    tickets.length === 0;

  const actions = useMemo(() => emphasizeNewTicketAction(baseActions, showEmptyState), [baseActions, showEmptyState]);

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <>
      <PageLayout
        title={title}
        backButton={backButton}
        actions={actions.length > 0 ? actions : undefined}
        menuActions={menuActions.length > 0 ? menuActions : undefined}
        actionsVariant="menu-primary"
        selector={selector}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        contentClassName="flex flex-col"
      >
        <div style={containerStyle}>
          {/* Default rich empty state (no data, no query): search + filters are hidden per the
              Figma data-placeholder-onboarding pattern — only the title bar chrome stays. */}
          {!showEmptyState && (
            <div
              ref={toolbarRef}
              className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex flex-col gap-[var(--spacing-system-xxs)] bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
            >
              <TicketTagFilter
                search={search}
                onSearchChange={onSearchChange}
                tagIds={tagIds}
                onTagIdsChange={onTagIdsChange}
                filterButton={
                  hasMobileFilter ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setMobileFilterOpen(true)}
                      aria-label="Open filters"
                      leftIcon={<Filter02Icon className="text-ods-text-primary" />}
                    />
                  ) : undefined
                }
              />
            </div>
          )}

          {hasMobileFilter && (
            <TicketsFilterModal
              isOpen={mobileFilterOpen}
              onClose={() => setMobileFilterOpen(false)}
              organizationIds={organizationIds ?? []}
              assigneeIds={assigneeIds ?? []}
              status={{ value: statusFilters ?? [], options: statusModalOptions }}
              onApply={handleModalApply}
            />
          )}

          {showEmptyState ? (
            <TicketsEmptyState />
          ) : (
            <TicketTableBody
              tickets={tickets}
              isLoading={isLoading}
              emptyMessage={emptyMessage}
              skeletonRows={10}
              stickyHeaderOffset={stickyHeaderOffset}
              isArchived={isArchived}
              statusOptions={statusOptions}
              assigneeOptions={assigneeOptions}
              columnFilters={isArchived ? undefined : columnFilters}
              onColumnFiltersChange={isArchived ? undefined : onColumnFiltersChange}
              getUnreadCount={getUnreadCount}
              footerSlot={
                <DataTable.InfiniteFooter
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={handleFetchNextPage}
                  skeletonRows={2}
                />
              }
            />
          )}
        </div>
      </PageLayout>
      {ticketsActionsDialog}
    </>
  );
}

export function CurrentTickets(props: Omit<TicketsTableProps, 'isArchived'>) {
  return <TicketsTable isArchived={false} {...props} />;
}

export function ArchivedTickets(props: Omit<TicketsTableProps, 'isArchived'>) {
  return <TicketsTable isArchived={true} {...props} />;
}
