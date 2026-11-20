'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CURSOR_PAGER_KEYS, useApiParams, useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useMemo, useState } from 'react';
import type { SoftwareOnDeviceFilterInput } from '@/__generated__/softwareDevicesTableQuery.graphql';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { FLEET_SEARCH_DEBOUNCE_MS } from '../../shared/fleet-list-paging';
import { useServerSort } from '../../shared/use-server-sort';
import { SOFTWARE_DEVICES_PAGE_SIZE, SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS } from './software-devices-columns';
import { SoftwareDevicesTable } from './software-devices-table';

/**
 * The tab's URL params live under this prefix (`deviceSearch`, `deviceStatus`, `deviceSortBy`, `deviceCursor`, …):
 * the Vulnerabilities tab shares the page's URL.
 */
const PARAM_PREFIX = 'device';

/**
 * Software → Devices: every machine carrying this title, with its own installed
 * version and lifecycle status. Owns the tab's URL state and search toolbar;
 * the rows suspend below it.
 */
export const SoftwareDevicesTab = memo(function SoftwareDevicesTabImpl({
  softwareId,
  loading = false,
}: {
  softwareId: string;
  /** The module's flag has not answered yet: the toolbar draws locked, the rows do not fetch. */
  loading?: boolean;
}) {
  // A change to the search, the funnel or the sort drops the pager's cursor in the SAME URL write (one history entry
  // on page 2+, so Back returns to the old view).
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      status: { type: 'array', default: [] },
      sortBy: { type: 'string', default: '' },
      sortDir: { type: 'string', default: 'desc' },
    },
    { prefix: PARAM_PREFIX, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    prefix: PARAM_PREFIX,
    pageSize: SOFTWARE_DEVICES_PAGE_SIZE,
    ...PAGED_LISTS.softwareDevices,
    resetOn: JSON.stringify(params),
  });

  // Local search input keeps typing responsive; the shared hook debounces it to the URL param.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    FLEET_SEARCH_DEBOUNCE_MS,
  );

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const { sort, sortState, onSortChange } = useServerSort({
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    sortableIds: SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS,
    onChange: (sortBy, sortDir) => setParams({ sortBy, sortDir }),
  });

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references.
  const queryVars = useMemo(() => {
    const filter: SoftwareOnDeviceFilterInput | null =
      params.status.length > 0 ? { statuses: params.status as SoftwareOnDeviceFilterInput['statuses'] } : null;
    return { filter, sort };
  }, [params.status, sort]);
  // The query reads the search from the URL, not the box's debounced value: the URL write that carries a new search
  // drops the cursor in the same navigation, so the two can never meet in one request.
  const {
    deferredFilters: deferredVars,
    deferredSearch,
    deferredPage,
    isPending,
  } = useDeferredQuery(queryVars, params.search, pager.variables);

  const rows = (
    <SoftwareDevicesTable
      softwareId={softwareId}
      backendFilters={deferredVars.filter}
      debouncedSearch={deferredSearch}
      sort={deferredVars.sort}
      sortState={sortState}
      onSortChange={onSortChange}
      statusFilter={params.status}
      onStatusFilterChange={values => setParam('status', values)}
      isPending={isPending}
      onEmptyChange={setIsEmpty}
      stickyHeaderOffset={stickyHeaderOffset}
      pager={pager}
      pageVariables={deferredPage}
      paramPrefix={PARAM_PREFIX}
    />
  );

  return (
    <div className="flex flex-col pt-[var(--spacing-system-l)]" style={containerStyle}>
      {!isEmpty && (
        <SearchToolbar
          toolbarRef={toolbarRef}
          placeholder="Search for Devices"
          value={searchInput}
          onChange={setSearchInput}
          disabled={loading}
        />
      )}

      {/* The rows before they answer, the same for a query in flight (the table's own boundary) and for the flag's own
          window: the table itself, in a loading scope, where it draws its own loading state and does not fetch. */}
      <LoadingWhen loading={loading}>{rows}</LoadingWhen>
    </div>
  );
});
SoftwareDevicesTab.displayName = 'SoftwareDevicesTab';
