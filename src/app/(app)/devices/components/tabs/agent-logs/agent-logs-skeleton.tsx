'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CheckboxBlock, Input, Skeleton, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DEVICE_LOG_LEVELS, getDeviceLogLevelVariant } from '../../../utils/device-log-level';
import { DEFAULT_DEVICE_LOG_RANGE, DEVICE_LOG_RANGE_LABELS } from '../../../utils/device-log-time';
import { AGENT_LOG_LEVEL_COLUMN, AGENT_LOG_ROW_HEIGHT_PX, AGENT_LOG_TIME_COLUMN } from './agent-log-columns';

/** Boxed from the row's own geometry (`agent-log-columns.ts`) rather than a
 *  copy of it, so the swap to real content cannot shift the list. */
export function AgentLogsRowsSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-[var(--spacing-system-xs)] px-[var(--spacing-system-xs)]"
          style={{ height: AGENT_LOG_ROW_HEIGHT_PX }}
        >
          <Skeleton className={`h-5 shrink-0 ${AGENT_LOG_TIME_COLUMN}`} />
          <Skeleton className={`h-8 shrink-0 ${AGENT_LOG_LEVEL_COLUMN}`} />
          <Skeleton className="h-5 flex-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * The whole tab while the device itself loads: the REAL toolbar, disabled, over
 * skeleton rows — the loaded tab lands on the same chrome.
 */
export function AgentLogsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col gap-[var(--spacing-system-m)] md:flex-row md:items-start">
        <Input
          placeholder="Search for Log"
          disabled
          className="flex-1"
          startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
        />
        <CheckboxBlock label="Auto-Update" checked disabled truncateLabel className="md:w-auto md:shrink-0" />
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
          {DEVICE_LOG_LEVELS.map(level => (
            <Tag key={level} label={level} variant={getDeviceLogLevelVariant(level)} disabled />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <Skeleton className="h-11 min-w-[180px] flex-1 md:h-12 md:w-[200px] md:flex-none">
            <span className="sr-only">{DEVICE_LOG_RANGE_LABELS[DEFAULT_DEVICE_LOG_RANGE]}</span>
          </Skeleton>
          <Skeleton className="h-11 w-11 shrink-0 md:h-12 md:w-12" />
        </div>
      </div>
      <AgentLogsRowsSkeleton />
    </div>
  );
}
