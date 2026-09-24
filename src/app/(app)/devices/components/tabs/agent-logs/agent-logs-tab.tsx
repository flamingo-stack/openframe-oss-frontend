'use client';

import type { DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { startOfDay, subDays } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import { dateRangeFromParams, toDayParam } from '@/lib/date-filter-params';
import { DEVICE_LOGS_REFRESH_PARAM } from '@/lib/routes';
import type { DeviceLogFilter } from '../../../types/device-log.types';
import type { Device } from '../../../types/device.types';
import { DEVICE_LOG_LEVELS } from '../../../utils/device-log-level';
import {
  EMPTY_DEVICE_LOG_SEARCH,
  type ParsedDeviceLogSearch,
  parseDeviceLogSearch,
} from '../../../utils/device-log-search';
import {
  DEFAULT_DEVICE_LOG_RANGE,
  deviceLogCustomBounds,
  type DeviceLogRangePreset,
  isDeviceLogRangePreset,
  MAX_DEVICE_LOG_RANGE_DAYS,
  adoptRefreshStamp,
  presetToFromInstant,
} from '../../../utils/device-log-time';
import { AgentLogsContent, type AgentLogsList } from './agent-logs-content';
import { AgentLogsErrorState } from './agent-logs-error-state';
import { AgentLogsRowsSkeleton } from './agent-logs-skeleton';
import { AgentLogsToolbar } from './agent-logs-toolbar';

/** Production retention; the empty state mentions it for ranges that reach past it. */
const RETENTION_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const isDeviceLogLevel = (value: string): value is DeviceLogLevel =>
  (DEVICE_LOG_LEVELS as readonly string[]).includes(value);

interface AgentLogsTabProps {
  device: Device;
}

/**
 * Device details → Agent Logs (CU-86agb21qt), newest first. Filter state rides
 * the URL under `log*` keys so it never collides with the Overview tab's own
 * logs table.
 */
export function AgentLogsTab({ device }: AgentLogsTabProps) {
  const machineId = device.machineId || device.id;
  const searchParams = useSearchParams();
  // The Run Script modal's "Device Logs" stamps a fresh value to force a reload.
  const refreshParam = searchParams.get(DEVICE_LOGS_REFRESH_PARAM) ?? '';

  const { params, setParam, setParams } = useApiParams({
    logSearch: { type: 'string', default: '' },
    logLevels: { type: 'array', default: [] },
    logRange: { type: 'string', default: DEFAULT_DEVICE_LOG_RANGE },
    logFrom: { type: 'string', default: '' },
    logTo: { type: 'string', default: '' },
  });

  const { search, setSearch, debouncedSearch } = useSearchParam(params.logSearch, value =>
    setParam('logSearch', value),
  );
  // Seeded EMPTY, not from the URL: a shared link can carry a search the limits
  // reject, and the latch below only covers later edits (FE-12). The query
  // follows the debounced text only while it parses, so a rejection holds.
  const liveSearch = parseDeviceLogSearch(search);
  // The latch holds the TEXT, not the parse: comparing parses by identity made
  // the render-phase update fire again on every render.
  const [validSearchText, setValidSearchText] = useState('');
  if (parseDeviceLogSearch(debouncedSearch).error === null && debouncedSearch !== validSearchText) {
    setValidSearchText(debouncedSearch);
  }
  // This memo and the ones feeding `filter` are for identity, not speed:
  // `useDeferredQuery` tells a pending refetch apart by reference.
  const validSearch = useMemo<ParsedDeviceLogSearch>(
    () => (validSearchText === '' ? EMPTY_DEVICE_LOG_SEARCH : parseDeviceLogSearch(validSearchText)),
    [validSearchText],
  );

  // De-duplicated: a URL repeating a level would reach the "all levels" count
  // below and silently send none, while the chips still read as partly on.
  const selectedLevels = useMemo(() => [...new Set(params.logLevels.filter(isDeviceLogLevel))], [params.logLevels]);
  const range: DeviceLogRangePreset = isDeviceLogRangePreset(params.logRange)
    ? params.logRange
    : DEFAULT_DEVICE_LOG_RANGE;
  const customRange = useMemo(() => dateRangeFromParams(params.logFrom, params.logTo), [params.logFrom, params.logTo]);

  // "Now" is fixed per list, not per render: a sliding `from` would be a new
  // filter on every render. The clock is read only in events (a preset change,
  // the refresh button) and the Run Script modal's stamp below.
  const [anchorNow, setAnchorNow] = useState(() => Date.now());
  // A stamp is an event, not a floor: adopted once when it changes, so a future one
  // cannot pin the window past Refresh.
  const [seenStamp, setSeenStamp] = useState(refreshParam);
  if (refreshParam !== seenStamp) {
    setSeenStamp(refreshParam);
    const adopted = adoptRefreshStamp(refreshParam, anchorNow);
    if (adopted !== null) setAnchorNow(adopted);
  }
  const refresh = () => setAnchorNow(Date.now());

  const filter = useMemo<DeviceLogFilter>(() => {
    const next: DeviceLogFilter = {};
    // Every level on and every level off both mean "send no levels".
    if (selectedLevels.length > 0 && selectedLevels.length < DEVICE_LOG_LEVELS.length) next.levels = selectedLevels;
    if (validSearch.contains.length > 0) next.contains = validSearch.contains;
    if (validSearch.excludes.length > 0) next.excludes = validSearch.excludes;
    const bounds = range === 'custom' ? deviceLogCustomBounds(customRange) : {};
    if (bounds.from) {
      next.from = bounds.from;
      if (bounds.to) next.to = bounds.to;
    } else {
      // A custom preset with no dates picked yet falls back to the default window.
      const preset = range === 'custom' ? DEFAULT_DEVICE_LOG_RANGE : range;
      next.from = presetToFromInstant(preset, new Date(anchorNow));
    }
    return next;
  }, [selectedLevels, validSearch, range, customRange, anchorNow]);

  const list = useMemo<AgentLogsList>(
    () => ({ filter, key: `${machineId}|${JSON.stringify(filter)}|${anchorNow}` }),
    [machineId, filter, anchorNow],
  );
  // Same contract every other list here uses: the rows lag the controls, so a
  // filter change dims the current page instead of dropping it to a skeleton.
  const { deferredFilters: deferredList, isPending } = useDeferredQuery(list, '');

  // Published by the boundary's fallback: a search the WAF rejected belongs at
  // the box, not over the list (spec §8).
  const [serverSearchError, setServerSearchError] = useState<string | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);
  // From the DEFERRED list: its errors are the ones being classified.
  const hasSearch = Boolean(deferredList.filter.contains?.length || deferredList.filter.excludes?.length);
  const hasActiveFilters =
    selectedLevels.length > 0 || search !== '' || range !== DEFAULT_DEVICE_LOG_RANGE || customRange !== undefined;
  const beyondRetention =
    filter.from !== undefined && anchorNow - Date.parse(String(filter.from)) > RETENTION_DAYS * DAY_MS;
  const customBounds = useMemo(() => {
    const today = new Date(anchorNow);
    // 29 days back, so any pick (inclusive of both end days) stays under the cap.
    return { min: startOfDay(subDays(today, MAX_DEVICE_LOG_RANGE_DAYS - 1)), max: today };
  }, [anchorNow]);

  const toggleLevel = (level: DeviceLogLevel) => {
    const on = selectedLevels.length === 0 ? [...DEVICE_LOG_LEVELS] : selectedLevels;
    const next = on.includes(level) ? on.filter(item => item !== level) : [...on, level];
    setParam('logLevels', next.length === DEVICE_LOG_LEVELS.length ? [] : next);
  };

  const changeRange = (next: DeviceLogRangePreset) => {
    setAnchorNow(Date.now());
    setParams({ logRange: next, ...(next === 'custom' ? {} : { logFrom: '', logTo: '' }) });
  };

  const changeCustomRange = (next: DateRange | undefined) => {
    setParams({
      logRange: 'custom',
      logFrom: next?.from ? toDayParam(next.from) : '',
      logTo: next?.to ? toDayParam(next.to) : '',
    });
  };

  const resetFilters = () => {
    setSearch('');
    setParams({ logSearch: '', logLevels: [], logRange: DEFAULT_DEVICE_LOG_RANGE, logFrom: '', logTo: '' });
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <AgentLogsToolbar
        search={search}
        onSearchChange={setSearch}
        searchError={liveSearch.error ?? serverSearchError}
        selectedLevels={selectedLevels}
        onToggleLevel={toggleLevel}
        range={range}
        onRangeChange={changeRange}
        customRange={customRange}
        onCustomRangeChange={changeCustomRange}
        customBounds={customBounds}
        autoUpdate={autoUpdate}
        onAutoUpdateChange={setAutoUpdate}
        onRefresh={refresh}
        isRefreshing={isPending}
      />
      <ContentErrorBoundary
        label="AgentLogsTab"
        // The deferred key: the live one would remount the failed list and re-send it.
        resetKey={deferredList.key}
        fallback={(retry, { error }) => (
          <AgentLogsErrorState
            error={error}
            hasSearch={hasSearch}
            retry={retry}
            onSearchRejected={setServerSearchError}
          />
        )}
      >
        <Suspense fallback={<AgentLogsRowsSkeleton />}>
          <AgentLogsContent
            machineId={machineId}
            deviceHostname={device.hostname}
            list={deferredList}
            isPending={isPending}
            autoUpdate={autoUpdate}
            hasSearch={hasSearch}
            beyondRetention={beyondRetention}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
          />
        </Suspense>
      </ContentErrorBoundary>
    </div>
  );
}
