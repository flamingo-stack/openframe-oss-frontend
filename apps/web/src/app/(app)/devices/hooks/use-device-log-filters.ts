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
  'params' | 'pendingParams' | 'setParam' | 'setParams'
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
 * The controls show `pendingParams`, the last write's intent, and the query
 * follows `params`, the URL: a pick repaints the control at once instead of a
 * router round trip later, while the list still changes exactly once per URL.
 */
export function useDeviceLogFilters(
  { params, pendingParams, setParam, setParams }: DeviceLogParamsApi,
  { defaultRange = DEFAULT_DEVICE_LOG_RANGE }: DeviceLogFiltersOptions = {},
): DeviceLogFilters {
  const searchParams = useSearchParams();
  const { search, setSearch } = useSearchParam(params.logSearch, value => setParam('logSearch', value));

  // Memoized for identity: `useDeferredQuery` tells a pending refetch apart by reference.
  const parsedSearch = useMemo(() => parseDeviceLogSearch(params.logSearch), [params.logSearch]);
  const selectedLevels = useMemo(() => levelsOf(params.logLevels), [params.logLevels]);
  const urlRange: DeviceLogRange = isDeviceLogRange(params.logRange) ? params.logRange : defaultRange;
  const customRange = useMemo(() => dateRangeFromParams(params.logFrom, params.logTo), [params.logFrom, params.logTo]);

  // The same three as the controls draw them: the intent while a write is in flight, the URL otherwise.
  const shownLevels = useMemo(() => levelsOf(pendingParams.logLevels), [pendingParams.logLevels]);
  const shownRange: DeviceLogRange = isDeviceLogRange(pendingParams.logRange) ? pendingParams.logRange : defaultRange;
  const shownCustomRange = useMemo(
    () => dateRangeFromParams(pendingParams.logFrom, pendingParams.logTo),
    [pendingParams.logFrom, pendingParams.logTo],
  );

  // "Now" is fixed per list and read in events only, so a preset's window does not slide on every render.
  // Refresh moves it, and so does the `refresh` stamp "View Device Logs" sets after a script run.
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const anchor = Math.max(refreshedAt, Number(searchParams.get('refresh')) || 0);
  // A preset's URL lands a router round trip after the click; the anchor moves with it, so the change is one request.
  const [pendingAnchor, setPendingAnchor] = useState<{ range: DeviceLogRange; at: number } | null>(null);
  if (pendingAnchor !== null && pendingAnchor.range === urlRange) {
    setPendingAnchor(null);
    setRefreshedAt(pendingAnchor.at);
  }

  const filter = useMemo<DeviceLogsFilter>(() => {
    const next: DeviceLogsFilter = deviceLogRangeBounds(urlRange, customRange, anchor, defaultRange);
    // Every level on and every level off both mean "send no levels".
    if (selectedLevels.length > 0 && selectedLevels.length < DEVICE_LOG_LEVELS.length) next.levels = selectedLevels;
    if (parsedSearch.error === null) {
      if (parsedSearch.contains.length > 0) next.contains = parsedSearch.contains;
      if (parsedSearch.excludes.length > 0) next.excludes = parsedSearch.excludes;
    }
    return next;
  }, [urlRange, customRange, anchor, defaultRange, selectedLevels, parsedSearch]);

  // A range that ended before this list was made cannot grow, so there is nothing to tail.
  const rangeClosed = filter.to != null && (parseInstant(filter.to)?.getTime() ?? Infinity) <= anchor;
  const hasFilters = shownLevels.length > 0 || search !== '' || shownRange !== defaultRange;

  const toggleLevel = (level: DeviceLogLevel) => {
    const on = shownLevels.length === 0 ? [...DEVICE_LOG_LEVELS] : shownLevels;
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
    setParams(deviceLogParamReset(defaultRange));
  };

  return {
    search,
    setSearch,
    searchError: parsedSearch.error,
    selectedLevels: shownLevels,
    toggleLevel,
    range: shownRange,
    changeRange,
    customRange: shownCustomRange,
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
