'use client';

import { TableCellIcon, TableColIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo } from 'react';
import { useSearchParam } from '@/app/hooks/use-search-param';
import type { TicketActivityFilter } from '../types/dialog.types';
import { resolveTicketsViewMode, type TicketsViewMode } from '../utils/resolve-view-mode';
import { TicketsBoard } from './tickets-board';
import { CurrentTickets } from './tickets-table';

const ACTIVITY_FILTER_VALUES: readonly TicketActivityFilter[] = ['ACTIVE', 'STALE', 'AWAITING_EXTERNAL'];

/**
 * The only URL param that lands in a GraphQL enum position: a hand-edited
 * `?activity=FOO` (or a duplicated value overflowing the server's max-3
 * validation) would fail enum coercion for EVERY lane query and error the
 * whole board. Intersecting with the canonical value list both whitelists
 * and dedupes; unknown entries are silently dropped, like an unknown
 * `viewMode` falls back to the board.
 */
function sanitizeActivityParam(raw: readonly string[]): TicketActivityFilter[] {
  return ACTIVITY_FILTER_VALUES.filter(value => raw.includes(value));
}

export function TicketsView() {
  const { params, setParam, setParams } = useApiParams({
    status: { type: 'array', default: [] },
    organizationIds: { type: 'array', default: [] },
    assigneeIds: { type: 'array', default: [] },
    tagIds: { type: 'array', default: [] },
    // Written as `unread=true` or dropped: a boolean param serializes `false`
    // literally, and the URL should carry the filter only while it is on.
    unread: { type: 'boolean', default: false },
    // Board activity filter; values mirror the server's TicketActivityFilter
    // enum (ACTIVE / STALE / AWAITING_EXTERNAL), OR-ed together.
    activity: { type: 'array', default: [] },
    search: { type: 'string', default: '' },
    // No default: an absent param stays distinguishable from an explicit
    // `viewMode=table`, so clearing the param returns to the board default.
    viewMode: { type: 'string', default: '' },
  });

  const viewMode = resolveTicketsViewMode(params.viewMode);
  const activity = useMemo(() => sanitizeActivityParam(params.activity), [params.activity]);

  // Local search keeps typing responsive; the shared hook debounces the write to
  // the URL param so we don't navigate the router (and re-render the board) on
  // every keystroke.
  const { search, setSearch } = useSearchParam(params.search, value => setParam('search', value), 300);

  const handleOrganizationIdsChange = useCallback((ids: string[]) => setParam('organizationIds', ids), [setParam]);
  const handleAssigneeIdsChange = useCallback((ids: string[]) => setParam('assigneeIds', ids), [setParam]);
  const handleTagIdsChange = useCallback((ids: string[]) => setParam('tagIds', ids), [setParam]);
  const handleUnreadOnlyChange = useCallback((value: boolean) => setParam('unread', value || null), [setParam]);
  const handleActivityChange = useCallback(
    (values: TicketActivityFilter[]) => setParam('activity', values),
    [setParam],
  );
  // Single URL write: two sequential setParam calls read the same snapshot and clobber each other.
  const handleFiltersChange = useCallback(
    ({
      unreadOnly,
      activity: nextActivity,
      ...filters
    }: {
      organizationIds: string[];
      assigneeIds: string[];
      unreadOnly: boolean;
      activity: TicketActivityFilter[];
    }) => setParams({ ...filters, unread: unreadOnly || null, activity: nextActivity }),
    [setParams],
  );
  // The table's variant also carries the status filter (its mobile modal and
  // the column-header filters both go through this one atomic write).
  const handleTableFiltersChange = useCallback(
    ({
      unreadOnly,
      ...filters
    }: {
      status: string[];
      assigneeIds: string[];
      organizationIds: string[];
      unreadOnly: boolean;
    }) => setParams({ ...filters, unread: unreadOnly || null }),
    [setParams],
  );

  // Rendered in the header on md+ and as the first row of the "…" menu on
  // mobile (the `menu-primary` PageActions surfaces the selector there).
  const tabs = useMemo(
    () => (
      <TabSelector
        value={viewMode}
        onValueChange={v => setParam('viewMode', v as TicketsViewMode)}
        items={[
          { id: 'table', icon: <TableCellIcon className="h-6 w-6" />, ariaLabel: 'Table view' },
          { id: 'board', icon: <TableColIcon className="h-6 w-6" />, ariaLabel: 'Board view' },
        ]}
      />
    ),
    [viewMode, setParam],
  );

  if (viewMode === 'board') {
    return (
      <TicketsBoard
        selector={tabs}
        organizationIds={params.organizationIds}
        onOrganizationIdsChange={handleOrganizationIdsChange}
        assigneeIds={params.assigneeIds}
        onAssigneeIdsChange={handleAssigneeIdsChange}
        tagIds={params.tagIds}
        onTagIdsChange={handleTagIdsChange}
        unreadOnly={params.unread}
        onUnreadOnlyChange={handleUnreadOnlyChange}
        activity={activity}
        onActivityChange={handleActivityChange}
        onFiltersChange={handleFiltersChange}
        search={search}
        onSearchChange={setSearch}
      />
    );
  }

  return (
    <CurrentTickets
      statusFilters={params.status}
      organizationIds={params.organizationIds}
      assigneeIds={params.assigneeIds}
      unreadOnly={params.unread}
      onFiltersChange={handleTableFiltersChange}
      selector={tabs}
      tagIds={params.tagIds}
      onTagIdsChange={handleTagIdsChange}
      search={search}
      onSearchChange={setSearch}
    />
  );
}
