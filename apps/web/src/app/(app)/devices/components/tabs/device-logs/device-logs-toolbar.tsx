'use client';

import { Refresh01RightIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, CheckboxBlock, type DateRange, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import type { DeviceLogRange } from '../../../utils/device-log-time';
import { DeviceLogLevelChips } from './device-log-level-chips';
import { DeviceLogRangeSelect } from './device-log-range-select';

interface DeviceLogsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Why the typed text is not applied; shown under the box. */
  searchError: string | null;
  /** Empty = every level. */
  selectedLevels: ReadonlyArray<DeviceLogLevel>;
  onToggleLevel: (level: DeviceLogLevel) => void;
  range: DeviceLogRange;
  onRangeChange: (range: DeviceLogRange) => void;
  customRange: DateRange | undefined;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  pickerBounds: { fromDate: Date; toDate: Date };
  autoUpdate: boolean;
  onAutoUpdateChange: (enabled: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** The device is still loading: the real bar, locked. */
  disabled?: boolean;
}

/** Search + Auto-Update, then level chips, the range and Refresh. Outside the list's Suspense so the search box keeps focus. */
export function DeviceLogsToolbar({
  search,
  onSearchChange,
  searchError,
  selectedLevels,
  onToggleLevel,
  range,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  pickerBounds,
  autoUpdate,
  onAutoUpdateChange,
  onRefresh,
  isRefreshing,
  disabled = false,
}: DeviceLogsToolbarProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col gap-[var(--spacing-system-mf)] content-md:flex-row content-md:items-start">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="Search for Log"
            aria-label="Search device logs"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
            error={searchError ?? undefined}
            disabled={disabled}
          />
        </div>
        <CheckboxBlock
          id="device-logs-auto-update"
          label="Auto-Update"
          checked={autoUpdate}
          onCheckedChange={onAutoUpdateChange}
          disabled={disabled}
          truncateLabel
          className="content-md:w-auto content-md:shrink-0"
        />
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-s)] content-md:flex-row content-md:items-center content-md:justify-between">
        <DeviceLogLevelChips selectedLevels={selectedLevels} onToggleLevel={onToggleLevel} disabled={disabled} />

        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <DeviceLogRangeSelect
            range={range}
            onRangeChange={onRangeChange}
            customRange={customRange}
            onCustomRangeChange={onCustomRangeChange}
            pickerBounds={pickerBounds}
            disabled={disabled}
            triggerClassName="min-w-[180px] flex-1 content-md:w-[200px] content-md:flex-none"
            pickerClassName="min-w-[220px] flex-1 content-md:w-[290px] content-md:flex-none"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh logs"
            onClick={onRefresh}
            disabled={disabled || isRefreshing}
            leftIcon={<Refresh01RightIcon className="text-ods-text-secondary" />}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
