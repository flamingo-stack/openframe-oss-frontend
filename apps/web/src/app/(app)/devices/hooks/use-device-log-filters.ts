'use client';

import type { DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { UseApiParamsReturn } from '@flamingo-stack/openframe-frontend-core/hooks';
import { defineParamSchema } from '@flamingo-stack/openframe-frontend-core/utils';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSearchParam } from '@/app/hooks/use-search-param';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import { dateRangeFromParams, toDayParam } from '@/lib/date-filter-params';
import { parseInstant } from '@/lib/graphql-scalars';
import type { DeviceLogsFilter } from '../components/tabs/device-logs/device-logs-list';
import { DEVICE_LOG_LEVELS, isDeviceLogLevel } from '../utils/device-log-level';
import { parseDeviceLogSearch } from '../utils/device-log-search';
import {
  DEFAULT_DEVICE_LOG_RANGE,
  type DeviceLogPreset,
  type DeviceLogRange,
  deviceLogPickerBounds,
  deviceLogRangeBounds,
  isDeviceLogRange,
} from '../utils/device-log-time';

/**
 * The URL params every device-log list reads, under `log*` keys so they never
 * collide with another table's on the same page (the device Overview's logs
 * table, say). A surface with params of its own spreads these into its schema
 * and hands the one `useApiParams` result to {@link useDeviceLogFilters}: two
 * hooks writing the same URL would race, each re-basing on a search string the
 * other's write has not reached yet.
 *
 * `defaultRange` is the preset an untouched URL reads as — a device's own tab
 * can afford a day, a tenant-wide list opens on the last hour.
 */
export function deviceLogParamSchema(defaultRange: DeviceLogPreset = DEFAULT_DEVICE_LOG_RANGE) {
  return defineParamSchema({
    logSearch: { type: 'string', default: '' },
    logLevels: { type: 'array', default: [] },
    logRange: { type: 'string', default: defaultRange },
    logFrom: { type: 'string', default: '' },
    logTo: { type: 'string', default: '' },
  });
}

export const DEVICE_LOG_PARAM_SCHEMA = deviceLogParamSchema();

/** Every log param at its default — one `setParams` payload, so a Reset is one URL write. */
export function deviceLogParamReset(defaultRange: DeviceLogPreset = DEFAULT_DEVICE_LOG_RANGE) {
  return {
    logSearch: '',
    logLevels: [],
    logRange: defaultRange,
    logFrom: '',
    logTo: '',
  } satisfies Record<keyof typeof DEVICE_LOG_PARAM_SCHEMA, unknown>;
}

export const DEVICE_LOG_PARAM_RESET = deviceLogParamReset();

/** The part of a `useApiParams` result the hook reads and writes; a wider schema fits. */
export type DeviceLogParamsApi = Pick<
  UseApiParamsReturn<typeof DEVICE_LOG_PARAM_SCHEMA>,
  'pendingParams' | 'setParam' | 'setParams'
>;

export interface DeviceLogFiltersOptions {
  /** The preset an untouched URL reads as. Defaults to {@link DEFAULT_DEVICE_LOG_RANGE}. */
  defaultRange?: DeviceLogPreset;
}

export interface DeviceLogFilters {
  /** The search box, live; `filter` carries the parsed, debounced terms. */
  search: string;
  setSearch: (value: string) => void;
  /** Why the typed text is not applied; shown under the box. */
  searchError: string | null;
  /** Empty = every level. */
  selectedLevels: readonly DeviceLogLevel[];
  toggleLevel: (level: DeviceLogLevel) => void;
  range: DeviceLogRange;
  changeRange: (range: DeviceLogRange) => void;
  customRange: DateRange | undefined;
  changeCustomRange: (range: DateRange | undefined) => void;
  pickerBounds: { fromDate: Date; toDate: Date };
  /** The `DeviceLogFilterInput` for the query; a new object only when a value changes. */
  filter: DeviceLogsFilter;
  /** "Now" for the presets, fixed per list; part of the list key so Refresh makes a new list. */
  anchor: number;
  /** The window ended before the list was made (a custom range in the past): nothing to tail. */
  rangeClosed: boolean;
  /** Something is narrowed beyond the defaults — the empty state's Reset is offered. */
  hasFilters: boolean;
  /** Puts every log param back; a surface with params of its own resets those in the same write. */
  resetFilters: () => void;
  refresh: () => void;
}

/** The levels a URL names, each once, in the order given. */
function levelsOf(values: readonly string[]): DeviceLogLevel[] {
  return [...new Set(values.filter(isDeviceLogLevel))];
}

/**
 * The device-log filter controls and the `DeviceLogFilterInput` they amount to,
 * on top of the URL params in {@link deviceLogParamSchema}. Shared by a
 * device's Device Logs tab and the Troubleshooting page: which devices the
 * list reads is the caller's, everything about *which lines* is here.
 *
 * The controls AND the query read `pendingParams`, the last write's intent, not
 * `params`, the URL. Next commits a URL write inside a transition, and a list
 * that suspends in that transition holds the commit until its data lands: read
 * from the URL, a pick froze the controls and the list for as long as the query
 * took, and `useDeferredQuery` never reported it pending (`useDeferredValue`
 * does not defer inside a transition). Read from the intent, a pick is an urgent
 * update: the controls repaint at once, and the list keeps its rows, marked
 * pending, until the next ones arrive. The URL only mirrors the intent for
 * links and back/forward, which reach `pendingParams` once nothing is in flight.
 */
export function useDeviceLogFilters(
  { pendingParams: params, setParam, setParams }: DeviceLogParamsApi,
  { defaultRange = DEFAULT_DEVICE_LOG_RANGE }: DeviceLogFiltersOptions = {},
): DeviceLogFilters {
  const searchParams = useSearchParams();
  const { search, setSearch } = useSearchParam(params.logSearch, value => setParam('logSearch', value));

  // Memoized for identity: `useDeferredQuery` tells a pending refetch apart by reference.
  const parsedSearch = useMemo(() => parseDeviceLogSearch(params.logSearch), [params.logSearch]);
  const selectedLevels = useMemo(() => levelsOf(params.logLevels), [params.logLevels]);
  const range: DeviceLogRange = isDeviceLogRange(params.logRange) ? params.logRange : defaultRange;
  const customRange = useMemo(() => dateRangeFromParams(params.logFrom, params.logTo), [params.logFrom, params.logTo]);

  // "Now" is fixed per list and read in events only, so a preset's window does not slide on every render.
  // Refresh moves it, and so does the `refresh` stamp "View Device Logs" sets after a script run.
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const anchor = Math.max(refreshedAt, Number(searchParams.get('refresh')) || 0);

  const filter = useMemo<DeviceLogsFilter>(() => {
    const next: DeviceLogsFilter = deviceLogRangeBounds(range, customRange, anchor, defaultRange);
    // Every level on and every level off both mean "send no levels".
    if (selectedLevels.length > 0 && selectedLevels.length < DEVICE_LOG_LEVELS.length) next.levels = selectedLevels;
    if (parsedSearch.error === null) {
      if (parsedSearch.contains.length > 0) next.contains = parsedSearch.contains;
      if (parsedSearch.excludes.length > 0) next.excludes = parsedSearch.excludes;
    }
    return next;
  }, [range, customRange, anchor, defaultRange, selectedLevels, parsedSearch]);

  // A range that ended before this list was made cannot grow, so there is nothing to tail.
  const rangeClosed = filter.to != null && (parseInstant(filter.to)?.getTime() ?? Infinity) <= anchor;
  const hasFilters = selectedLevels.length > 0 || search !== '' || range !== defaultRange;

  const toggleLevel = (level: DeviceLogLevel) => {
    const on = selectedLevels.length === 0 ? [...DEVICE_LOG_LEVELS] : selectedLevels;
    const next = on.includes(level) ? on.filter(item => item !== level) : [...on, level];
    setParam('logLevels', next.length === DEVICE_LOG_LEVELS.length ? [] : next);
  };
  const changeRange = (next: DeviceLogRange) => {
    // The window counts back from the pick; both updates land in one render, so the change is one request.
    setRefreshedAt(Date.now());
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
    setParams(deviceLogParamReset(defaultRange));
  };

  return {
    search,
    setSearch,
    searchError: parsedSearch.error,
    selectedLevels,
    toggleLevel,
    range,
    changeRange,
    customRange,
    changeCustomRange,
    pickerBounds: deviceLogPickerBounds(anchor),
    filter,
    anchor,
    rangeClosed,
    hasFilters,
    resetFilters,
    refresh: () => setRefreshedAt(Date.now()),
  };
}
