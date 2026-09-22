'use client';

import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, Suspense, useMemo, useState } from 'react';
import type { SoftwareOnDeviceFilterInput } from '@/__generated__/softwareDevicesTableQuery.graphql';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareSearchToolbar } from '../../shared/software-search-toolbar';
import { useServerSort } from '../../shared/use-server-sort';
import {
  SOFTWARE_DEVICES_PAGE_SIZE,
  SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS,
  SOFTWARE_DEVICES_TABLE_COLUMNS,
} from './software-devices-columns';
import { SoftwareDevicesTable } from './software-devices-table';

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
  const { params, setParam, setParams } = useApiParams({
    deviceSearch: { type: 'string', default: '' },
    deviceStatus: { type: 'array', default: [] },
    deviceSortBy: { type: 'string', default: '' },
    deviceSortDir: { type: 'string', default: 'desc' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.deviceSearch, value => setParam('deviceSearch', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const { sort, sortState, onSortChange } = useServerSort({
    sortBy: params.deviceSortBy,
    sortDir: params.deviceSortDir,
    sortableIds: SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS,
    onChange: (sortBy, sortDir) => setParams({ deviceSortBy: sortBy, deviceSortDir: sortDir }),
  });

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references.
  const queryVars = useMemo(() => {
    const filter: SoftwareOnDeviceFilterInput | null =
      params.deviceStatus.length > 0
        ? { statuses: params.deviceStatus as SoftwareOnDeviceFilterInput['statuses'] }
        : null;
    return { filter, sort };
  }, [params.deviceStatus, sort]);
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  // The rows before they answer — the same for a query in flight and for the flag's own window.
  const tableSkeleton = (
    <TableSkeleton
      columns={SOFTWARE_DEVICES_TABLE_COLUMNS}
      rows={SOFTWARE_DEVICES_PAGE_SIZE}
      stickyHeaderOffset={stickyHeaderOffset}
    />
  );

  return (
    <div className="flex flex-col pt-[var(--spacing-system-l)]" style={containerStyle}>
      {!isEmpty && (
        <SoftwareSearchToolbar
          toolbarRef={toolbarRef}
          placeholder="Search for Devices"
          value={searchInput}
          onChange={setSearchInput}
          disabled={loading}
        />
      )}

      {loading ? (
        tableSkeleton
      ) : (
        <Suspense fallback={tableSkeleton}>
          <SoftwareDevicesTable
            softwareId={softwareId}
            backendFilters={deferredVars.filter}
            debouncedSearch={deferredSearch}
            sort={deferredVars.sort}
            sortState={sortState}
            onSortChange={onSortChange}
            statusFilter={params.deviceStatus}
            onStatusFilterChange={values => setParam('deviceStatus', values)}
            isPending={isPending}
            onEmptyChange={setIsEmpty}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </Suspense>
      )}
    </div>
  );
});
SoftwareDevicesTab.displayName = 'SoftwareDevicesTab';
