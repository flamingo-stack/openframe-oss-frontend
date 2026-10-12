'use client';

import {
  DatePicker,
  type DateRange,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DEVICE_LOG_RANGE_LABELS, DEVICE_LOG_RANGES, type DeviceLogRange } from '../../../utils/device-log-time';

interface DeviceLogRangeSelectProps {
  range: DeviceLogRange;
  onRangeChange: (range: DeviceLogRange) => void;
  customRange: DateRange | undefined;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  pickerBounds: { fromDate: Date; toDate: Date };
  disabled?: boolean;
  /** The preset trigger's width is the caller's: it sits in a different row on each surface. */
  triggerClassName?: string;
  pickerClassName?: string;
}

/**
 * The range presets, and the day picker a custom range adds beside them. A fragment:
 * the caller's row decides how the two share the line.
 */
export function DeviceLogRangeSelect({
  range,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  pickerBounds,
  disabled = false,
  triggerClassName,
  pickerClassName,
}: DeviceLogRangeSelectProps) {
  return (
    <>
      <Select value={range} onValueChange={value => onRangeChange(value as DeviceLogRange)} disabled={disabled}>
        <SelectTrigger aria-label="Time range" className={triggerClassName}>
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
          className={pickerClassName}
        />
      )}
    </>
  );
}
