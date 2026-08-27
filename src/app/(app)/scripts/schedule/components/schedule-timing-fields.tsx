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
import { useCallback, useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { EditScheduleFormData } from '../types/edit-schedule.types';
import {
  DURATION_UNIT_OPTIONS,
  type DurationUnit,
  getTimeSlotOptions,
  isEventTrigger,
  isScheduleStartInPast,
  isStartInPastAndChanged,
  MIN_REPEAT_MINUTES,
  PAST_START_MESSAGE,
  slotToLabel,
  snapRepeatInterval,
  startOfToday,
} from '../utils/schedule-timing';
import { ScheduleIntervalInput } from './schedule-interval-input';

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
 * row is unchanged and a COLLAPSED row leaves no 24px hole.
 *
 * That padding sits on the field row INSIDE the clipping box, not on the box
 * itself, and the difference is load-bearing: a box is never shorter than its own
 * padding — `border-box` does not change that, it only decides what a specified
 * height includes — so padding on the grid item survives the 0fr track as 24px of
 * residue. The negative margin then spends itself cancelling that instead of
 * closing the section gap, and the collapsed row leaves the hole this was written
 * to avoid. Nested one level down it is clipped like everything else, and the row
 * measures 0.
 */
export function ScheduleTimingFields({ showErrors, disabled = false }: { showErrors: boolean; disabled?: boolean }) {
  const { control, getValues, setValue, trigger: triggerValidation } = useFormContext<EditScheduleFormData>();

  /**
   * Re-checks the reconnect window after the cadence moves.
   *
   * The rule "the window must be shorter than the cadence" is attached to
   * `reconnectInterval`, and react-hook-form only refreshes the error of the
   * field that just fired an event — so fixing the CADENCE left the complaint
   * sitting under the offline block until the next Save, pointing at a value
   * that was already legal.
   *
   * Called on the cadence's blur and on its two discrete controls, never
   * per-keystroke: the half-typed "6" of "60" is briefly shorter than the
   * window, and grading it would flash an error at a number still being
   * written. Silent until the first Save, like every other rule here.
   */
  const recheckReconnectWindow = useCallback(() => {
    if (showErrors) triggerValidation('reconnectInterval');
  }, [showErrors, triggerValidation]);
  const trigger = useWatch({ control, name: 'trigger' });
  const repeatEnabled = useWatch({ control, name: 'repeatEnabled' });
  const repeatUnit = useWatch({ control, name: 'repeatUnit' });
  const scheduledDate = useWatch({ control, name: 'scheduledDate' });
  const scheduledTime = useWatch({ control, name: 'scheduledTime' });
  const eventDriven = isEventTrigger(trigger);
  // Minutes are the one unit that can express a cadence finer than the runner's
  // 30-minute grid, so they are the one unit the stepper has to constrain — it
  // then produces only legal values, and the schema rule behind it is left to
  // catch typed-in ones.
  const intervalStep = repeatUnit === 'minute' ? MIN_REPEAT_MINUTES : 1;
  // Local slots, so the grid depends on the viewer's timezone — built per mount
  // rather than at import time, which would happen on the server, and rebuilt
  // per picked DAY because today offers only the slots still ahead.
  //
  // A stored start that has already gone by today keeps its option: it is the
  // value the form holds and will save if nothing else changes, and a Select
  // whose value is missing from its list renders as the placeholder — the field
  // would read empty on a schedule that has a perfectly good start time.
  const timeSlots = useMemo(() => {
    const slots = getTimeSlotOptions(scheduledDate);
    if (!scheduledTime || slots.some(slot => slot.value === scheduledTime)) return slots;
    return [{ value: scheduledTime, label: slotToLabel(scheduledTime) }, ...slots];
  }, [scheduledDate, scheduledTime]);
  // Today, recomputed per mount so a tab left open overnight cannot still treat
  // yesterday as selectable. Handed to the picker as `fromDate`, which greys out
  // every earlier day and stops the calendar paging past it.
  //
  // ⚠ Requires a core library that TRANSLATES that prop. Up to and including
  // 0.0.514 the calendar forwarded it straight to react-day-picker v9, where
  // `fromDate` was removed — the bound was silently dropped and past days stayed
  // clickable. Fixed in core (`DatePickerCalendar` maps it to a `disabled`
  // matcher); if this app is ever pinned back below that release, the two rules
  // below are what still hold the line.
  //
  // They are not a fallback in any case: a disabled day cannot stop the clock
  // from passing the SLOT this form already holds, and the seeded value never
  // went through the calendar at all.
  const minDate = useMemo(() => startOfToday(), []);

  /**
   * Moving the DAY can invalidate the time already chosen: 8:00 AM is a fine
   * slot for tomorrow and a gone one for today. The dropdown stops offering it,
   * so a stale value would sit in the form as an empty-looking Select that fails
   * validation on Save — clear it instead, and let the user re-pick from what
   * the new day actually has. A day that keeps the slot keeps the value.
   *
   * Only for a day that is itself selectable: on a PAST day every slot is in the
   * past, and clearing the time there would replace the real complaint ("that
   * day has gone") with a second, misleading one ("pick a time").
   */
  const handleDateChange = useCallback(
    (onChange: (date: Date | null) => void, date: Date | null) => {
      onChange(date);
      const time = getValues('scheduledTime');
      if (date && time && date >= minDate && isScheduleStartInPast(date, time)) setValue('scheduledTime', '');
    },
    [getValues, setValue, minDate],
  );

  // Shown IMMEDIATELY, unlike every other rule on this form, which waits for
  // Save: the calendar cannot withhold a past day itself (see `minDate`), so a
  // picked one has to say so at once rather than look accepted until Save
  // refuses it. Same predicate the schema uses — stored past starts exempt — so
  // the field and the save can never disagree.
  const startAtStored = useWatch({ control, name: 'startAtStored' });
  const startsInPast = !eventDriven && isStartInPastAndChanged(scheduledDate, scheduledTime, startAtStored);
  // On the field the user can act on: a past DAY is the date's problem, a past
  // slot of today is the time's.
  const pastDateError = startsInPast && scheduledDate && scheduledDate < minDate ? PAST_START_MESSAGE : undefined;
  const pastTimeError = startsInPast && !pastDateError ? PAST_START_MESSAGE : undefined;

  return (
    <div
      inert={eventDriven}
      style={{
        gridTemplateRows: eventDriven ? '0fr' : '1fr',
        opacity: eventDriven ? 0 : 1,
      }}
      className="grid mb-[calc(-1*var(--spacing-system-lf))] transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
    >
      <div className="overflow-hidden min-h-0">
        <div className="pb-[var(--spacing-system-lf)] flex flex-col md:flex-row gap-[var(--spacing-system-lf)] md:items-end">
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
                    onChange={date => handleDateChange(field.onChange, date ?? null)}
                    // No day before today: a schedule cannot start in the past.
                    fromDate={minDate}
                    disabled={disabled}
                    className="w-full"
                    error={pastDateError ?? (showErrors ? fieldState.error?.message : undefined)}
                    invalid={!!pastDateError || (showErrors && !!fieldState.error)}
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
                    error={pastTimeError ?? (showErrors ? fieldState.error?.message : undefined)}
                    invalid={!!pastTimeError || (showErrors && !!fieldState.error)}
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
                  onCheckedChange={next => {
                    field.onChange(next);
                    // Turning recurrence off removes the cadence the window is
                    // measured against, so the rule stops applying entirely.
                    recheckReconnectWindow();
                  }}
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
                  <ScheduleIntervalInput
                    min={intervalStep}
                    className="w-full"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={() => {
                      field.onBlur();
                      recheckReconnectWindow();
                    }}
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
                    onValueChange={(next: DurationUnit) => {
                      field.onChange(next);
                      const snapped = snapRepeatInterval(getValues('repeatInterval'), next);
                      if (snapped !== getValues('repeatInterval')) setValue('repeatInterval', snapped);
                      recheckReconnectWindow();
                    }}
                    disabled={disabled || !repeatEnabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_UNIT_OPTIONS.map(opt => (
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
