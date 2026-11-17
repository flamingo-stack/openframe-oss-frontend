'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useMemo, useState } from 'react';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { DeviceTagsFilter } from '../../shared/device-tags-filter';
import type { ListSelections } from '../../shared/software-list-frame';
import { useServerSort } from '../../shared/use-server-sort';
import { toSoftwareOnDeviceFilter } from './software-device-filters';
import { SOFTWARE_DEVICES_SORTABLE_COLUMN_IDS } from './software-devices-columns';
import { SoftwareDevicesTable } from './software-devices-table';

/**
 * Software → Devices: every machine carrying this title, with its own installed
 * version and lifecycle status. Owns the tab's URL state (search, sort, the
 * three funnels and the Device Tags window) and its toolbar; the rows suspend
 * below it.
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
    deviceInstalledBy: { type: 'array', default: [] },
    deviceAutoUpdate: { type: 'array', default: [] },
    deviceTags: { type: 'array', default: [] },
    deviceSortBy: { type: 'string', default: '' },
    deviceSortDir: { type: 'string', default: 'desc' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.deviceSearch, value => setParam('deviceSearch', value));

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
  const selections = useMemo<ListSelections>(
    () => ({
      softwareVersion: params.deviceStatus,
      installedBy: params.deviceInstalledBy,
      autoUpdate: params.deviceAutoUpdate,
    }),
    [params.deviceStatus, params.deviceInstalledBy, params.deviceAutoUpdate],
  );
  const queryVars = useMemo(
    () => ({ filter: toSoftwareOnDeviceFilter(selections, params.deviceTags), sort }),
    [selections, params.deviceTags, sort],
  );
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  const rows = (
    <SoftwareDevicesTable
      softwareId={softwareId}
      backendFilters={deferredVars.filter}
      debouncedSearch={deferredSearch}
      sort={deferredVars.sort}
      sortState={sortState}
      onSortChange={onSortChange}
      selections={selections}
      onSelectionsChange={next =>
        setParams({
          deviceStatus: next.softwareVersion ?? [],
          deviceInstalledBy: next.installedBy ?? [],
          deviceAutoUpdate: next.autoUpdate ?? [],
        })
      }
      isPending={isPending}
      onEmptyChange={setIsEmpty}
      stickyHeaderOffset={stickyHeaderOffset}
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
          actions={
            <DeviceTagsFilter
              value={params.deviceTags}
              onChange={tagIds => setParam('deviceTags', tagIds)}
              disabled={loading}
            />
          }
        />
      )}

      {/* The rows before they answer, the same for a query in flight (the table's own boundary) and for the flag's own
          window: the table itself, in a loading scope, where it draws its own loading state and does not fetch. */}
      <LoadingWhen loading={loading}>{rows}</LoadingWhen>
    </div>
  );
});
SoftwareDevicesTab.displayName = 'SoftwareDevicesTab';
