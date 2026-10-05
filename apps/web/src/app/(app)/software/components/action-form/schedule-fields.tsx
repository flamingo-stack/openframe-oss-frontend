'use client';

import {
  DatePickerInputSimple,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { TIME_REFERENCE_OPTIONS } from '@/app/(app)/scripts/schedule/types/edit-schedule.types';
import {
  earliestScheduleDay,
  getTimeSlotOptions,
  isScheduleStartInPast,
  PAST_START_MESSAGE,
} from '@/app/(app)/scripts/schedule/utils/schedule-timing';
import type { ScheduleTimeReference } from '@/generated/schema-enums';

interface ScheduleFieldsProps {
  date: Date | null;
  time: string;
  timeReference: ScheduleTimeReference;
  onDateChange: (date: Date | null) => void;
  onTimeChange: (time: string) => void;
  onTimeReferenceChange: (reference: ScheduleTimeReference) => void;
}

/** Date / Time / Timezone — the same grid and readings as a script schedule's start. */
export function ScheduleFields({
  date,
  time,
  timeReference,
  onDateChange,
  onTimeChange,
  onTimeReferenceChange,
}: ScheduleFieldsProps) {
  const timeOptions = getTimeSlotOptions(date, timeReference);
  const inPast = isScheduleStartInPast(date, time, timeReference);

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] md:grid-cols-4 md:items-start">
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Date</Label>
        <DatePickerInputSimple
          placeholder="Select date"
          value={date ?? undefined}
          onChange={next => onDateChange(next ?? null)}
          fromDate={earliestScheduleDay(timeReference)}
          className="w-full"
          error={inPast ? PAST_START_MESSAGE : undefined}
          invalid={inPast}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Time</Label>
        <Select value={time} onValueChange={onTimeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Timezone</Label>
        <Select value={timeReference} onValueChange={value => onTimeReferenceChange(value as ScheduleTimeReference)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_REFERENCE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
