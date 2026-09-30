'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { DEFAULT_DEVICE_LOG_RANGE } from '../../../utils/device-log-time';
import { DEVICE_LOG_LEVEL_COLUMN, DEVICE_LOG_LINE, DEVICE_LOG_TIME_COLUMN } from './device-log-layout';
import { DeviceLogsToolbar } from './device-logs-toolbar';

export function DeviceLogsRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn('rounded-md border border-transparent', DEVICE_LOG_LINE)}>
          <Skeleton className={cn('h-5 shrink-0', DEVICE_LOG_TIME_COLUMN)} />
          <Skeleton className={cn('h-8 shrink-0', DEVICE_LOG_LEVEL_COLUMN)} />
          <Skeleton className="h-5 flex-1" />
        </div>
      ))}
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
      <DeviceLogsRowsSkeleton />
    </div>
  );
}
