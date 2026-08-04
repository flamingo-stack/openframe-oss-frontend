'use client';

import { XmarkCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  CheckboxBlock,
  DatePickerInputSimple,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { EditScheduleFormData } from '../types/edit-schedule.types';
import {
  getTimeSlotOptions,
  isEventTrigger,
  MIN_REPEAT_MINUTES,
  REPEAT_UNIT_OPTIONS,
  type RepeatUnit,
  snapRepeatInterval,
} from '../utils/schedule-timing';

/**
 * Date | Time | Repeat | Repeat in — the timing a DATE_TIME schedule fires on.
 *
 * `scheduledDate` + `scheduledTime` combine into the backend's `startAt` (30-min
 * boundary, enforced by the Time slots) and are both required; the repeat toggle
 * + interval + unit become `repeat` seconds.
 *
 * Only DATE_TIME schedules have timing, so the row collapses when the event
 * trigger is picked. It stays MOUNTED (a toggle back restores what was typed)
 * and animates with the `0fr → 1fr` grid-rows technique — the portable way to
 * transition to an intrinsic height, since `interpolate-size` / `calc-size()`
 * still aren't cross-browser. `inert` drops the collapsed fields out of the tab
 * order and the accessibility tree.
 *
 * The `overflow-hidden` the technique requires also clips anything hanging below
 * the fields — and field errors are absolutely positioned there (out of flow, so
 * showing one never reflows the form). The bottom padding is the room they render
 * into; the constant negative margin cancels it again, so the spacing below the
 * row is unchanged and a COLLAPSED row still leaves no 24px hole (a 0fr track
 * zeroes the padding too — `border-box`).
 */
export function ScheduleTimingFields({ showErrors, disabled = false }: { showErrors: boolean; disabled?: boolean }) {
  const { control, getValues, setValue } = useFormContext<EditScheduleFormData>();
  const trigger = useWatch({ control, name: 'trigger' });
  const repeatEnabled = useWatch({ control, name: 'repeatEnabled' });
  const repeatUnit = useWatch({ control, name: 'repeatUnit' });
  const eventDriven = isEventTrigger(trigger);
  // Minutes are the one unit that can express a cadence finer than the runner's
  // 30-minute grid, so they are the one unit the stepper has to constrain — it
  // then produces only legal values, and the schema rule behind it is left to
  // catch typed-in ones.
  const intervalStep = repeatUnit === 'minute' ? MIN_REPEAT_MINUTES : 1;
  // Local slots, so the grid depends on the viewer's timezone — built once per
  // mount rather than at import time, which would happen on the server.
  const timeSlots = useMemo(() => getTimeSlotOptions(), []);

  return (
    <div
      inert={eventDriven}
      style={{
        gridTemplateRows: eventDriven ? '0fr' : '1fr',
        opacity: eventDriven ? 0 : 1,
      }}
      className="grid mb-[calc(-1*var(--spacing-system-lf))] transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
    >
      <div className="overflow-hidden min-h-0 pb-[var(--spacing-system-lf)]">
        <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)] md:items-end">
          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Date</Label>
            <Controller
              name="scheduledDate"
              control={control}
              render={({ field, fieldState }) => (
                // The core picker has no clear affordance, so the design's xmark
                // rides on top of the trigger's free right edge.
                <div className="relative">
                  <DatePickerInputSimple
                    placeholder="Select date"
                    value={field.value ?? undefined}
                    onChange={date => field.onChange(date ?? null)}
                    disabled={disabled}
                    className="w-full"
                    error={showErrors ? fieldState.error?.message : undefined}
                    invalid={showErrors && !!fieldState.error}
                  />
                  {field.value && !disabled && (
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      aria-label="Clear date"
                      className="absolute right-3 top-6 -translate-y-1/2 text-ods-text-secondary hover:text-ods-text-primary"
                    >
                      <XmarkCircleIcon size={24} />
                    </button>
                  )}
                </div>
              )}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Time</Label>
            <Controller
              name="scheduledTime"
              control={control}
              render={({ field, fieldState }) => (
                // `''` reads as "no selection" to Radix, so the placeholder shows
                // until a slot is picked — a date at midnight no longer
                // masquerades as a chosen 12:00 AM.
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  {/* No `border-ods-border` here: the trigger already sets it, and
                      a repeat of it in `className` lands AFTER the invalid branch
                      in the component's `cn()`, so tailwind-merge would drop the
                      error border. */}
                  <SelectTrigger
                    className="w-full"
                    error={showErrors ? fieldState.error?.message : undefined}
                    invalid={showErrors && !!fieldState.error}
                  >
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            <Controller
              name="repeatEnabled"
              control={control}
              render={({ field }) => (
                <CheckboxBlock
                  label="Repeat Script Run"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                  className="w-full"
                />
              )}
            />
          </div>

          <div className="flex-1 min-w-0 flex gap-[var(--spacing-system-xs)] items-end">
            <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
              <Label className="text-h4">Repeat in</Label>
              <Controller
                name="repeatInterval"
                control={control}
                render={({ field, fieldState }) => (
                  <Input
                    type="number"
                    min={intervalStep}
                    step={intervalStep}
                    className="w-full"
                    value={String(field.value ?? '')}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : intervalStep)}
                    disabled={disabled || !repeatEnabled}
                    error={showErrors ? fieldState.error?.message : undefined}
                    invalid={showErrors && !!fieldState.error}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Controller
                name="repeatUnit"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    // Switching TO minutes drags the interval up onto the grid
                    // with it: "1 Day" would otherwise become "1 Minute", a
                    // value the user never typed and the form cannot save. The
                    // other direction needs nothing — every coarser unit is
                    // already a whole number of slots at any interval.
                    onValueChange={(next: RepeatUnit) => {
                      field.onChange(next);
                      const snapped = snapRepeatInterval(getValues('repeatInterval'), next);
                      if (snapped !== getValues('repeatInterval')) setValue('repeatInterval', snapped);
                    }}
                    disabled={disabled || !repeatEnabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPEAT_UNIT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
