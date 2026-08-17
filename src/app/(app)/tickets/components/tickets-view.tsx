'use client';

import { TableCellIcon, TableColIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo } from 'react';
import { useIsMobileViewport } from '@/app/hooks/use-is-mobile-viewport';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { resolveTicketsViewMode, type TicketsViewMode } from '../utils/resolve-view-mode';
import { TicketsBoard } from './tickets-board';
import { TicketsPageSkeleton } from './tickets-page-skeleton';
import { CurrentTickets } from './tickets-table';

export function TicketsView() {
  const { params, setParam, setParams } = useApiParams({
    status: { type: 'array', default: [] },
    organizationIds: { type: 'array', default: [] },
    assigneeIds: { type: 'array', default: [] },
    tagIds: { type: 'array', default: [] },
    search: { type: 'string', default: '' },
    // No default: an absent param has to stay distinguishable from an explicit
    // `viewMode=board` for `resolveTicketsViewMode` to know when it may pick.
    viewMode: { type: 'string', default: '' },
  });

  const isMobileViewport = useIsMobileViewport();
  const viewMode = resolveTicketsViewMode(params.viewMode, isMobileViewport);

  // Local search keeps typing responsive; the shared hook debounces the write to
  // the URL param so we don't navigate the router (and re-render the board) on
  // every keystroke.
  const { search, setSearch } = useSearchParam(params.search, value => setParam('search', value), 300);

  const handleStatusFilterChange = useCallback((status: string[]) => setParam('status', status), [setParam]);
  const handleOrganizationIdsChange = useCallback((ids: string[]) => setParam('organizationIds', ids), [setParam]);
  const handleAssigneeIdsChange = useCallback((ids: string[]) => setParam('assigneeIds', ids), [setParam]);
  const handleTagIdsChange = useCallback((ids: string[]) => setParam('tagIds', ids), [setParam]);
  // Single URL write: two sequential setParam calls read the same snapshot and clobber each other.
  const handleFiltersChange = useCallback(
    (filters: { organizationIds: string[]; assigneeIds: string[] }) => setParams(filters),
    [setParams],
  );

  const tabs = useMemo(
    () => (
      <TabSelector
        // Never rendered before `viewMode` resolves — the guard below returns
        // the skeleton first — so the fallback here is only to satisfy the type.
        value={viewMode ?? 'board'}
        onValueChange={v => setParam('viewMode', v as TicketsViewMode)}
        items={[
          { id: 'table', icon: <TableCellIcon className="w-6 h-6" /> },
          { id: 'board', icon: <TableColIcon className="w-6 h-6" /> },
        ]}
      />
    ),
    [viewMode, setParam],
  );

  // The viewport is unknown for the first renders after hydration. Guessing a
  // mode would mount the wrong subtree and run its fetches before swapping it
  // out — the exact cost this split exists to avoid.
  if (!viewMode) {
    return <TicketsPageSkeleton viewMode={params.viewMode} />;
  }

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
        onFiltersChange={handleFiltersChange}
        search={search}
        onSearchChange={setSearch}
      />
    );
  }

  return (
    <CurrentTickets
      statusFilters={params.status}
      onStatusFilterChange={handleStatusFilterChange}
      selector={tabs}
      tagIds={params.tagIds}
      onTagIdsChange={handleTagIdsChange}
      search={search}
      onSearchChange={setSearch}
    />
  );
}
