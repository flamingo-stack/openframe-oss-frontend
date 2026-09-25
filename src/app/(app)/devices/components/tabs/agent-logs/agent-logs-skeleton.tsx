'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { InlineSkeleton } from '@/app/components/shared/page-skeleton-primitives';
import { DEFAULT_DEVICE_LOG_RANGE } from '../../../utils/device-log-time';
import { AGENT_LOG_COLUMN_VARS, AGENT_LOG_LEVEL_COLUMN, AGENT_LOG_TIME_COLUMN } from './agent-log-columns';
import { AgentLogsDayHeader } from './agent-logs-day-header';
import { AgentLogsToolbar } from './agent-logs-toolbar';

/** Boxed from the row's own geometry (`agent-log-columns.ts`) rather than a
 *  copy of it, so the swap to real content cannot shift the list. */
export function AgentLogsRowsSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-[var(--spacing-system-xs)] rounded-md border border-transparent px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)]',
            AGENT_LOG_COLUMN_VARS,
          )}
        >
          <Skeleton className={cn('h-5 shrink-0', AGENT_LOG_TIME_COLUMN)} />
          <Skeleton className={cn('h-8 shrink-0', AGENT_LOG_LEVEL_COLUMN)} />
          <Skeleton className="h-5 flex-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * The first page loading: the loaded list's own top — the live tail's 1px
 * sentinel and a day header — over rows, so the first rows land where they stood.
 */
export function AgentLogsListSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-hidden="true">
      <div className="h-px" />
      <AgentLogsDayHeader>
        <InlineSkeleton className="h-3 w-24" />
      </AgentLogsDayHeader>
      <AgentLogsRowsSkeleton />
    </div>
  );
}

/** Handlers for the locked bar: nothing to act on until the device is known. */
const noop = () => {};
/** Only read at the custom range, which a loading bar never shows. */
const NO_BOUNDS = { min: new Date(0), max: new Date(0) };

/**
 * The whole tab while the device itself loads: the real toolbar, disabled, over
 * the list skeleton — the loaded tab lands on the same chrome.
 */
export function AgentLogsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <AgentLogsToolbar
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
        customBounds={NO_BOUNDS}
        autoUpdate
        onAutoUpdateChange={noop}
        onRefresh={noop}
        isRefreshing={false}
      />
      <AgentLogsListSkeleton />
    </div>
  );
}
