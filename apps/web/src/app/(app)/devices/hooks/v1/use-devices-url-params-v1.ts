'use client';
// Main's apps/web/src/app/(app)/devices/hooks/use-devices-url-params.ts, rendered while tenant-management-v2 is off. Deleted with the flag.

import {
  DEFAULT_DEVICES_LIST_STATUSES,
  DEVICE_CONNECTIVITY_FILTER_SECTION,
  deviceStatusFilterGroups,
  type DeviceFilterInput,
  splitStatusFilterValue,
  useDeviceStatusDisplay,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { TagSearchOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo } from 'react';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { translateLegacyDeviceStatuses } from '../use-devices-url-params';

interface UseDevicesUrlParamsOptions {
  /**
   * Default statuses applied when the user hasn't picked any.
   * - omitted → `DEFAULT_DEVICES_LIST_STATUSES` (ONLINE / OFFLINE; PENDING is
   *   opt-in via the filter, DELETED and legacy ARCHIVED live on
   *   /devices/archive). Used on the main Devices page and the Customer devices tab.
   * - `[]` → no default, every status (including ARCHIVED / DELETED) returned;
   *   pair with `lockedFilters` to scope the query (e.g. the archive page).
   */
  defaultStatuses?: string[];
}

export function useDevicesUrlParamsV1(options: UseDevicesUrlParamsOptions = {}) {
  const defaultStatuses = options.defaultStatuses ?? DEFAULT_DEVICES_LIST_STATUSES;
  const statusDisplay = useDeviceStatusDisplay();

  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    statuses: { type: 'array', default: [] },
    connectivity: { type: 'array', default: [] },
    osTypes: { type: 'array', default: [] },
    organizationIds: { type: 'array', default: [] },
    tags: { type: 'array', default: [] },
    viewMode: { type: 'string', default: 'table' },
  });

  // Local search keeps typing responsive; the shared hook debounces it to the
  // URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: localSearch,
    setSearch: setLocalSearch,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 500);

  // Only "key:value" pairs go to the API
  const tagValues = useMemo(
    () =>
      params.tags.flatMap(tag => {
        const i = tag.indexOf(':');
        return i > 0 ? [tag.substring(i + 1)] : [];
      }),
    [params.tags],
  );

  // Selecting exactly the default status set is the same as no selection —
  // collapse it to [] so the URL stays clean (`?statuses=` is dropped) and it
  // never reads as an active filter. Applied on both read (a URL that spells
  // out the defaults) and write (Apply with all defaults checked).
  const normalizeStatuses = useCallback(
    (statuses: string[]) =>
      statuses.length === defaultStatuses.length && defaultStatuses.every(s => statuses.includes(s)) ? [] : statuses,
    [defaultStatuses],
  );

  const legacy = useMemo(
    () => translateLegacyDeviceStatuses(params.statuses, params.connectivity ?? []),
    [params.statuses, params.connectivity],
  );
  const selectedStatuses = useMemo(() => normalizeStatuses(legacy.statuses), [legacy.statuses, normalizeStatuses]);
  const selectedConnectivity = legacy.connectivity;

  const normalizedParams = useMemo(
    () => ({ ...params, statuses: selectedStatuses, connectivity: selectedConnectivity }),
    [params, selectedStatuses, selectedConnectivity],
  );

  const setParamsNormalized = useCallback(
    (next: Record<string, string[]>) =>
      setParams('statuses' in next ? { ...next, statuses: normalizeStatuses(next.statuses || []) } : next),
    [setParams, normalizeStatuses],
  );

  // When the user hasn't explicitly picked statuses, the QUERY falls back to the
  // defaults (online/offline). This is query-only: the filter UI shows just the
  // explicit selection (`selectedStatuses`), so nothing looks checked in the
  // default state.
  const effectiveStatuses = useMemo(
    () => (selectedStatuses.length > 0 ? selectedStatuses : defaultStatuses),
    [selectedStatuses, defaultStatuses],
  );

  const filters: DeviceFilterInput = useMemo(
    () => ({
      ...(effectiveStatuses.length > 0 && { statuses: effectiveStatuses }),
      ...(selectedConnectivity.length > 0 && { connectivity: selectedConnectivity }),
      osTypes: params.osTypes,
      organizationIds: params.organizationIds,
      ...(tagValues.length > 0 && { tagValues }),
    }),
    [effectiveStatuses, selectedConnectivity, params.osTypes, params.organizationIds, tagValues],
  );

  const tableFilters = useMemo(
    () => ({
      ...deviceStatusFilterGroups(selectedStatuses, selectedConnectivity, statusDisplay),
      os: params.osTypes,
      organization: params.organizationIds,
    }),
    [selectedStatuses, selectedConnectivity, params.osTypes, params.organizationIds, statusDisplay],
  );

  const tagOptions: TagSearchOption<string>[] = useMemo(
    () => params.tags.map(tag => ({ label: tag, value: tag })),
    [params.tags],
  );

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      const status = splitStatusFilterValue(columnFilters.status);
      setParamsNormalized({
        statuses: status.statuses,
        connectivity: [...status.connectivity, ...(columnFilters[DEVICE_CONNECTIVITY_FILTER_SECTION] ?? [])],
        osTypes: columnFilters.os || [],
        organizationIds: columnFilters.organization || [],
      });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [setParamsNormalized],
  );

  const handleTagRemove = useCallback(
    (value: string) => {
      setParam(
        'tags',
        params.tags.filter(t => t !== value),
      );
    },
    [params.tags, setParam],
  );

  const handleClearAll = useCallback(() => {
    setLocalSearch('');
    setParams({ tags: [], search: '' });
  }, [setParams, setLocalSearch]);

  return {
    params: normalizedParams,
    setParam,
    setParams: setParamsNormalized,
    localSearch,
    setLocalSearch,
    debouncedSearch,
    filters,
    tableFilters,
    tagOptions,
    handleFilterChange,
    handleTagRemove,
    handleClearAll,
  };
}
