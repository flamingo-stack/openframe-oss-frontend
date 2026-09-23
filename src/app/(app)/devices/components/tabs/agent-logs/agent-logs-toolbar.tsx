'use client';

import { Refresh01RightIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxBlock,
  DatePicker,
  type DateRange,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tag,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import { DEVICE_LOG_LEVELS, getDeviceLogLevelVariant } from '../../../utils/device-log-level';
import {
  DEVICE_LOG_RANGE_LABELS,
  DEVICE_LOG_RANGE_PRESETS,
  type DeviceLogRangePreset,
} from '../../../utils/device-log-time';

interface AgentLogsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Why the typed text will not be sent — shown under the box (spec FE-12). */
  searchError: string | null;
  /** Empty = every level (the chips all read "on"). */
  selectedLevels: ReadonlyArray<DeviceLogLevel>;
  onToggleLevel: (level: DeviceLogLevel) => void;
  range: DeviceLogRangePreset;
  onRangeChange: (range: DeviceLogRangePreset) => void;
  customRange: DateRange | undefined;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  /** Selectable days for the custom picker — the API's 30-day cap, ending today. */
  customBounds: { min: Date; max: Date };
  autoUpdate: boolean;
  onAutoUpdateChange: (enabled: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Figma `696:38908` (search + Auto-Update) plus the spec's level chips and
 * time-range presets on a second row. Lives outside the list's Suspense so the
 * search box keeps focus across re-queries.
 */
export function AgentLogsToolbar({
  search,
  onSearchChange,
  searchError,
  selectedLevels,
  onToggleLevel,
  range,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  customBounds,
  autoUpdate,
  onAutoUpdateChange,
  onRefresh,
  isRefreshing,
}: AgentLogsToolbarProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col gap-[var(--spacing-system-m)] md:flex-row md:items-start">
        <Input
          placeholder="Search for Log"
          aria-label="Search agent logs"
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          className="flex-1"
          startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
          error={searchError ?? undefined}
        />
        <CheckboxBlock
          id="agent-logs-auto-update"
          label="Auto-Update"
          checked={autoUpdate}
          onCheckedChange={onAutoUpdateChange}
          truncateLabel
          className="md:w-auto md:shrink-0"
        />
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Log levels" className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
          {DEVICE_LOG_LEVELS.map(level => {
            const on = selectedLevels.length === 0 || selectedLevels.includes(level);
            return (
              <button
                key={level}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleLevel(level)}
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
              >
                {/* `as="span"`: a button may only hold phrasing content, and
                    `Tag` renders a div by default. */}
                <Tag
                  as="span"
                  label={level}
                  variant={on ? getDeviceLogLevelVariant(level) : 'outline'}
                  className={cn('cursor-pointer', !on && 'text-ods-text-muted')}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <Select value={range} onValueChange={value => onRangeChange(value as DeviceLogRangePreset)}>
            <SelectTrigger aria-label="Time range" className="min-w-[180px] flex-1 md:w-[200px] md:flex-none">
              <SelectValue>{DEVICE_LOG_RANGE_LABELS[range]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DEVICE_LOG_RANGE_PRESETS.map(preset => (
                <SelectItem key={preset} value={preset}>
                  {DEVICE_LOG_RANGE_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {range === 'custom' && (
            <DatePicker
              mode="range"
              value={customRange}
              onChange={onCustomRangeChange}
              fromDate={customBounds.min}
              toDate={customBounds.max}
              placeholder="Select dates"
              className="min-w-[220px] flex-1 md:w-[290px] md:flex-none"
            />
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh logs"
            onClick={onRefresh}
            disabled={isRefreshing}
            leftIcon={<Refresh01RightIcon />}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
