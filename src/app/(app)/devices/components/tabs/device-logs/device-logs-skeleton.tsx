'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { DEFAULT_DEVICE_LOG_RANGE } from '../../../utils/device-log-time';
import {
  DEVICE_LOG_DAY_HEADER,
  DEVICE_LOG_LEVEL_COLUMN,
  DEVICE_LOG_LINE,
  DEVICE_LOG_TIME_COLUMN,
} from './device-log-layout';
import { DeviceLogsToolbar } from './device-logs-toolbar';

/**
 * Lines in the live row's geometry. `dayHeader` adds the day heading the live
 * list opens each day with — on for a list's first paint, off for the rows a
 * next page appends under one already drawn.
 */
export function DeviceLogsRowsSkeleton({ rows = 8, dayHeader = false }: { rows?: number; dayHeader?: boolean }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-hidden="true">
      {dayHeader && (
        <div className={DEVICE_LOG_DAY_HEADER}>
          {/* 1lh of text-h5: the heading's own line box, at every breakpoint. */}
          <Skeleton className="h-[1lh] w-28 text-h5" />
          <span className="h-px flex-1 bg-ods-border" />
        </div>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn('rounded-md border border-transparent', DEVICE_LOG_LINE)}>
          {/* text-code: the column is sized in `ch`, which only matches the live time's width in its font. */}
          <Skeleton className={cn('h-5 shrink-0 text-code', DEVICE_LOG_TIME_COLUMN)} />
          <Skeleton className={cn('h-8 shrink-0', DEVICE_LOG_LEVEL_COLUMN)} />
          <Skeleton className="h-5 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** The list before its first page: the live list's top sentinel, then a day of lines. */
export function DeviceLogsListSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-hidden="true">
      <div className="h-px" />
      <DeviceLogsRowsSkeleton dayHeader />
    </div>
  );
}

const noop = () => {};
/** Read only at the custom range, which a locked bar never shows. */
const NO_BOUNDS = { fromDate: new Date(0), toDate: new Date(0) };

/** The tab while the device loads: the real toolbar, locked, over the rows. */
export function DeviceLogsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <DeviceLogsToolbar
        disabled
        search=""
        onSearchChange={noop}
        searchError={null}
        selectedLevels={[]}
        onToggleLevel={noop}
        range={DEFAULT_DEVICE_LOG_RANGE}
        onRangeChange={noop}
        customRange={undefined}
        onCustomRangeChange={noop}
        pickerBounds={NO_BOUNDS}
        autoUpdate
        onAutoUpdateChange={noop}
        onRefresh={noop}
        isRefreshing={false}
      />
      <DeviceLogsListSkeleton />
    </div>
  );
}
