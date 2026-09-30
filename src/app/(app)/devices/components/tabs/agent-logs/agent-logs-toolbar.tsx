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
import type { KeyboardEvent } from 'react';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import { DEVICE_LOG_LEVELS, deviceLogLevelVariant } from '../../../utils/device-log-level';
import { DEVICE_LOG_RANGE_LABELS, DEVICE_LOG_RANGES, type DeviceLogRange } from '../../../utils/device-log-time';

interface AgentLogsToolbarProps {
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

/** Figma 696:38908: search + Auto-Update, then level chips, the range and Refresh. Outside the list's Suspense so the search box keeps focus. */
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
  pickerBounds,
  autoUpdate,
  onAutoUpdateChange,
  onRefresh,
  isRefreshing,
  disabled = false,
}: AgentLogsToolbarProps) {
  const chipKeyDown = (level: DeviceLogLevel) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleLevel(level);
    }
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col gap-[var(--spacing-system-mf)] md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="Search for Log"
            aria-label="Search agent logs"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
            error={searchError ?? undefined}
            disabled={disabled}
          />
        </div>
        <CheckboxBlock
          id="agent-logs-auto-update"
          label="Auto-Update"
          checked={autoUpdate}
          onCheckedChange={onAutoUpdateChange}
          disabled={disabled}
          truncateLabel
          className="md:w-auto md:shrink-0"
        />
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Log levels" className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
          {DEVICE_LOG_LEVELS.map(level => {
            const on = selectedLevels.length === 0 || selectedLevels.includes(level);
            return (
              <Tag
                key={level}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-pressed={on}
                label={<span>{level}</span>}
                variant={on ? deviceLogLevelVariant(level) : 'outline'}
                disabled={disabled}
                onClick={disabled ? undefined : () => onToggleLevel(level)}
                onKeyDown={disabled ? undefined : chipKeyDown(level)}
                className={cn(!disabled && 'cursor-pointer', !on && 'text-ods-text-muted')}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <Select value={range} onValueChange={value => onRangeChange(value as DeviceLogRange)} disabled={disabled}>
            <SelectTrigger aria-label="Time range" className="min-w-[180px] flex-1 md:w-[200px] md:flex-none">
              <SelectValue>{DEVICE_LOG_RANGE_LABELS[range]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DEVICE_LOG_RANGES.map(preset => (
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
              fromDate={pickerBounds.fromDate}
              toDate={pickerBounds.toDate}
              placeholder="Select dates"
              disabled={disabled}
              className="min-w-[220px] flex-1 md:w-[290px] md:flex-none"
            />
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh logs"
            onClick={onRefresh}
            disabled={disabled || isRefreshing}
            leftIcon={<Refresh01RightIcon />}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
