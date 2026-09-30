'use client';

import type { DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useMemo, useState } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import { dateRangeFromParams, toDayParam } from '@/lib/date-filter-params';
import type { Device } from '../../../types/device.types';
import { DEVICE_LOG_LEVELS, isDeviceLogLevel } from '../../../utils/device-log-level';
import { parseDeviceLogSearch } from '../../../utils/device-log-search';
import {
  DEFAULT_DEVICE_LOG_RANGE,
  type DeviceLogRange,
  deviceLogPickerBounds,
  deviceLogRangeBounds,
  isDeviceLogRange,
} from '../../../utils/device-log-time';
import { type AgentLogsFilter, AgentLogsList } from './agent-logs-list';
import { AgentLogsRowsSkeleton } from './agent-logs-skeleton';
import { AgentLogsToolbar } from './agent-logs-toolbar';

interface AgentLogsTabProps {
  device: Device;
}

/** Device details → Agent Logs (CU-86agb21qt). Filters ride the URL under `log*` keys, apart from the Overview logs table's. */
export function AgentLogsTab({ device }: AgentLogsTabProps) {
  const machineId = device.machineId || device.id;
  const { params, setParam, setParams } = useApiParams({
    logSearch: { type: 'string', default: '' },
    logLevels: { type: 'array', default: [] },
    logRange: { type: 'string', default: DEFAULT_DEVICE_LOG_RANGE },
    logFrom: { type: 'string', default: '' },
    logTo: { type: 'string', default: '' },
  });
  const { search, setSearch } = useSearchParam(params.logSearch, value => setParam('logSearch', value));

  // Memoized for identity: `useDeferredQuery` tells a pending refetch apart by reference.
  const parsedSearch = useMemo(() => parseDeviceLogSearch(params.logSearch), [params.logSearch]);
  const selectedLevels = useMemo(() => [...new Set(params.logLevels.filter(isDeviceLogLevel))], [params.logLevels]);
  const range: DeviceLogRange = isDeviceLogRange(params.logRange) ? params.logRange : DEFAULT_DEVICE_LOG_RANGE;
  const customRange = useMemo(() => dateRangeFromParams(params.logFrom, params.logTo), [params.logFrom, params.logTo]);

  // "Now" is fixed per list and read in events only, so a preset's window does not slide on every render.
  const [anchor, setAnchor] = useState(() => Date.now());
  // A preset's URL lands a router round trip after the click; the anchor moves with it, so the change is one request.
  const [pendingAnchor, setPendingAnchor] = useState<{ range: DeviceLogRange; at: number } | null>(null);
  if (pendingAnchor !== null && pendingAnchor.range === range) {
    setPendingAnchor(null);
    setAnchor(pendingAnchor.at);
  }

  const filter = useMemo<AgentLogsFilter>(() => {
    const next: AgentLogsFilter = deviceLogRangeBounds(range, customRange, anchor);
    // Every level on and every level off both mean "send no levels".
    if (selectedLevels.length > 0 && selectedLevels.length < DEVICE_LOG_LEVELS.length) next.levels = selectedLevels;
    if (parsedSearch.error === null) {
      if (parsedSearch.contains.length > 0) next.contains = parsedSearch.contains;
      if (parsedSearch.excludes.length > 0) next.excludes = parsedSearch.excludes;
    }
    return next;
  }, [range, customRange, anchor, selectedLevels, parsedSearch]);
  const list = useMemo(() => ({ key: `${machineId}|${JSON.stringify(filter)}`, filter }), [machineId, filter]);
  const { deferredFilters: deferredList, isPending } = useDeferredQuery(list, '');

  const [autoUpdate, setAutoUpdate] = useState(true);
  const hasFilters = selectedLevels.length > 0 || search !== '' || range !== DEFAULT_DEVICE_LOG_RANGE;

  const toggleLevel = (level: DeviceLogLevel) => {
    const on = selectedLevels.length === 0 ? [...DEVICE_LOG_LEVELS] : selectedLevels;
    const next = on.includes(level) ? on.filter(item => item !== level) : [...on, level];
    setParam('logLevels', next.length === DEVICE_LOG_LEVELS.length ? [] : next);
  };
  const changeRange = (next: DeviceLogRange) => {
    setPendingAnchor({ range: next, at: Date.now() });
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
        searchError={parsedSearch.error}
        selectedLevels={selectedLevels}
        onToggleLevel={toggleLevel}
        range={range}
        onRangeChange={changeRange}
        customRange={customRange}
        onCustomRangeChange={changeCustomRange}
        pickerBounds={deviceLogPickerBounds(anchor)}
        autoUpdate={autoUpdate}
        onAutoUpdateChange={setAutoUpdate}
        onRefresh={() => setAnchor(Date.now())}
        isRefreshing={isPending}
      />
      {/* The deferred key: the live one would remount a failed list and re-send it. */}
      <ContentErrorBoundary label="AgentLogsTab" message="Couldn't load agent logs." resetKey={deferredList.key}>
        <Suspense fallback={<AgentLogsRowsSkeleton />}>
          <AgentLogsList
            key={deferredList.key}
            machineId={machineId}
            filter={deferredList.filter}
            deviceHostname={device.hostname}
            isPending={isPending}
            autoUpdate={autoUpdate}
            hasFilters={hasFilters}
            onResetFilters={resetFilters}
          />
        </Suspense>
      </ContentErrorBoundary>
    </div>
  );
}
