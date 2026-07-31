'use client';

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SelectButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon, XmarkCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxBlock,
  DatePickerInputSimple,
  Input,
  Label,
  type PageActionButton,
  RadioGroupBlock,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { OS_PLATFORMS } from '@flamingo-stack/openframe-frontend-core/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { useMutation } from 'react-relay';
import { z } from 'zod';
import type { createScriptScheduleMutation as CreateScheduleMutationType } from '@/__generated__/createScriptScheduleMutation.graphql';
import type { updateScriptScheduleMutation as UpdateScheduleMutationType } from '@/__generated__/updateScriptScheduleMutation.graphql';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { ScriptScheduleTrigger } from '@/generated/schema-enums';
import { createScriptScheduleMutation } from '@/graphql/scripts/create-script-schedule-mutation';
import { updateScriptScheduleMutation } from '@/graphql/scripts/update-script-schedule-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import { parseKeyValues } from '../../utils/script-key-values';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '../../utils/script-utils';
import {
  applyTimeSlot,
  dateToTimeSlot,
  fromScheduleInstant,
  isEventTrigger,
  REPEAT_UNIT_OPTIONS,
  resolveRepeatSeconds,
  secondsToRepeatParts,
  TIME_SLOT_OPTIONS,
  toScheduleInstant,
} from '../utils/schedule-timing';
import { envVarsToPairs, platformsToEnums, platformsToIds } from '../utils/script-mappers';
import { type ScheduleDetailData, ScheduleDetailGate } from './schedule-detail-gate';
import { ScheduleScriptPickerCard } from './schedule-script-picker-card';
import { ScriptPageChrome } from './script-page-chrome';

// ----------------------------------------------------------------
// Form model
// ----------------------------------------------------------------

const DEFAULT_TIMEOUT_SECONDS = 90;

const keyValueSchema = z.object({ id: z.string(), key: z.string(), value: z.string() });

/**
 * UI platform id → its display name ("darwin" → "MacOS"). Reads the FULL
 * platform list, not `AVAILABLE_PLATFORMS`: Linux is hidden from the selector,
 * but a schedule authored elsewhere can still carry it, and that is exactly the
 * mismatch worth naming.
 */
function platformLabel(id: string): string {
  return OS_PLATFORMS.find(p => p.id === id)?.name ?? id;
}

/**
 * The list is one vertical column, so horizontal drift is noise — pin the drag
 * to the Y axis. (Inlined rather than pulling in `@dnd-kit/modifiers` for a
 * one-liner; this is that package's `restrictToVerticalAxis` verbatim.)
 */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const dragInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder this script, press Space or Enter to pick it up, then Arrow Up / Arrow Down to move it. ' +
    'Press Space or Enter again to drop it, or Escape to cancel.',
};

// `trigger` decides whether the timing block applies at all: DATE_TIME is the
// time-driven model below; DEVICE_ONLINE is event-driven and the backend keeps
// `startAt` / `repeat` null for it, so the whole Date & Time row is hidden and
// both fields are submitted as null.
//
// Timing maps to two backend fields: `startAt` (Instant, 30-min boundary — the
// Time dropdown only offers 30-minute slots) and `repeat` (Long seconds). The
// day and the time of day are kept as SEPARATE form fields and only combined on
// submit: a single `Date` cannot tell "date picked, time not chosen yet" from
// "midnight", which is exactly the case the required-field rule below has to
// catch. A "Run on schedule" trigger has no meaning without both, so both are
// required for DATE_TIME (which also subsumes the old "repeat needs a start to
// anchor it" rule).
//
// `scripts[]` order IS the run order — it is submitted as `scriptIds` verbatim,
// so dragging a card is a real, persisted change. `timeoutSeconds` / `args` /
// `envVars` are per-script run parameters the schedule model can NOT store yet
// (see docs/script-schedules-v2-graphql-gaps.md §3); they are seeded from the
// script's own defaults and are dropped on submit until `scriptEntries` lands.
const editScheduleFormSchema = z
  .object({
    name: z.string().min(1, 'Please enter a schedule name').max(255, 'Name must not exceed 255 characters'),
    description: z.string(),
    trigger: z.enum([ScriptScheduleTrigger.DATE_TIME, ScriptScheduleTrigger.DEVICE_ONLINE]),
    scheduledDate: z.date().nullable(),
    /** `HH:mm` on the 30-minute grid; `''` = the user hasn't picked a time yet. */
    scheduledTime: z.string(),
    repeatEnabled: z.boolean(),
    repeatInterval: z.number().int().min(1, 'Interval must be at least 1'),
    repeatUnit: z.enum(['hour', 'day', 'week', 'month']),
    /**
     * The `repeat` seconds this form was seeded with, carried along with no
     * control of its own. The interval/unit pair cannot express a sub-hour
     * cadence, so a schedule authored elsewhere displays rounded — and this is
     * what lets Save write the original back untouched (`resolveRepeatSeconds`)
     * instead of rewriting the cadence on an unrelated edit. `null` when
     * creating, or when the schedule has no recurrence.
     */
    repeatSecondsStored: z.number().nullable(),
    supportedPlatforms: z.array(z.string()).min(1, 'Please select at least one platform'),
    scripts: z
      .array(
        z
          .object({
            scriptId: z.string().min(1, 'Please select a script'),
            name: z.string(),
            /** The picked script's OWN platforms — checked against the schedule's below. */
            supportedPlatforms: z.array(z.string()),
            // 0 = no script picked yet, so the field is locked and empty; a real
            // timeout only exists once a script is chosen (it seeds this).
            timeoutSeconds: z.number().int().min(0),
            args: z.array(keyValueSchema),
            envVars: z.array(keyValueSchema),
          })
          .refine(entry => !entry.scriptId || entry.timeoutSeconds >= 1, {
            message: 'Timeout must be at least 1 second',
            path: ['timeoutSeconds'],
          }),
      )
      .min(1, 'Please add at least one script'),
  })
  // Cross-field rules — `superRefine` (not chained `.refine`s) so one submit
  // flags every offending field at once instead of walking the user through
  // them one save at a time.
  .superRefine((data, ctx) => {
    // A schedule dispatches every script to every platform it targets, so a
    // script that doesn't cover one of them simply never runs there — silently.
    // The picker only narrows candidates to scripts overlapping the schedule's
    // platforms, so a partial match (Windows-only script on a Windows + Linux
    // schedule) is reachable and has to be caught here. Flagged on the row,
    // where both fixes live: swap the script or drop the platform.
    data.scripts.forEach((entry, index) => {
      if (!entry.scriptId) return;
      const unsupported = data.supportedPlatforms.filter(p => !entry.supportedPlatforms.includes(p));
      if (unsupported.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `This script doesn't support ${unsupported.map(platformLabel).join(', ')}`,
          path: ['scripts', index, 'scriptId'],
        });
      }
    });

    // "Run on schedule" fires at a wall-clock instant, so it needs both halves
    // of one. Event-driven schedules carry no timing at all — their controls are
    // collapsed and both fields are submitted as null.
    if (isEventTrigger(data.trigger)) return;
    if (data.scheduledDate == null) {
      ctx.addIssue({ code: 'custom', message: 'Please select a start date', path: ['scheduledDate'] });
    }
    if (!data.scheduledTime) {
      ctx.addIssue({ code: 'custom', message: 'Please select a start time', path: ['scheduledTime'] });
    }
  });

export type EditScheduleFormData = z.infer<typeof editScheduleFormSchema>;

const EMPTY_SCRIPT_ROW: EditScheduleFormData['scripts'][number] = {
  scriptId: '',
  name: '',
  supportedPlatforms: [],
  // 0 keeps the Timeout field locked and empty until a script is picked.
  timeoutSeconds: 0,
  args: [],
  envVars: [],
};

const TRIGGER_OPTIONS = [
  {
    value: ScriptScheduleTrigger.DATE_TIME,
    label: 'Run on schedule',
    description: 'Runs at the set date and time, whether or not the device is online.',
  },
  {
    value: ScriptScheduleTrigger.DEVICE_ONLINE,
    label: 'Run when device comes online',
    description: "Waits for the device to connect, then runs as soon as it's reachable.",
  },
];

const DEFAULT_VALUES: EditScheduleFormData = {
  name: '',
  description: '',
  trigger: ScriptScheduleTrigger.DATE_TIME,
  scheduledDate: null,
  scheduledTime: '',
  repeatEnabled: false,
  repeatInterval: 1,
  repeatUnit: 'day',
  repeatSecondsStored: null,
  supportedPlatforms: ['windows'],
  scripts: [EMPTY_SCRIPT_ROW],
};

function scheduleToFormValues(schedule: ScheduleDetailData): EditScheduleFormData {
  const repeatParts = schedule.repeat ? secondsToRepeatParts(schedule.repeat) : null;
  // The stored instant carries both halves; the form keeps them apart.
  const startAt = schedule.startAt ? fromScheduleInstant(schedule.startAt) : null;
  return {
    name: schedule.name,
    description: schedule.description ?? '',
    trigger: isEventTrigger(schedule.trigger) ? ScriptScheduleTrigger.DEVICE_ONLINE : ScriptScheduleTrigger.DATE_TIME,
    scheduledDate: startAt,
    scheduledTime: startAt ? dateToTimeSlot(startAt) : '',
    repeatEnabled: Boolean(schedule.repeat),
    repeatInterval: repeatParts?.interval ?? 1,
    repeatUnit: repeatParts?.unit ?? 'day',
    repeatSecondsStored: schedule.repeat ?? null,
    supportedPlatforms: platformsToIds(schedule.supportedPlatforms),
    scripts:
      schedule.scripts.length > 0
        ? schedule.scripts.map(s => ({
            scriptId: s.id,
            name: s.name,
            supportedPlatforms: platformsToIds(s.supportedPlatforms),
            timeoutSeconds: s.defaultTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
            args: parseKeyValues(s.defaultArgs ? [...s.defaultArgs] : [], ' '),
            envVars: envVarsToPairs(s.envVars),
          }))
        : [EMPTY_SCRIPT_ROW],
  };
}

// ----------------------------------------------------------------
// Form — also its own loading state (the "pour data in" gate pattern)
// ----------------------------------------------------------------

interface EditScheduleFormProps {
  scheduleId: string | null;
  initialValues: EditScheduleFormData | null;
  /**
   * True while the schedule query is still in flight: every control renders
   * disabled and empty, and the values pour in once the data arrives. The real
   * form IS the loading state — no skeleton swap, no remount.
   */
  loading?: boolean;
}

function EditScheduleForm({ scheduleId, initialValues, loading = false }: EditScheduleFormProps) {
  const isEditMode = Boolean(scheduleId);
  const router = useRouter();
  const { toast } = useToast();
  const isMdUp = useMdUp();

  const [commitCreate, isCreating] = useMutation<CreateScheduleMutationType>(createScriptScheduleMutation);
  const [commitUpdate, isUpdating] = useMutation<UpdateScheduleMutationType>(updateScriptScheduleMutation);
  const isSaving = isCreating || isUpdating;

  const methods = useForm<EditScheduleFormData>({
    resolver: zodResolver(editScheduleFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { control, handleSubmit, watch, formState } = methods;

  const { fields, append, remove, move } = useFieldArray({ control, name: 'scripts' });
  const supportedPlatforms = watch('supportedPlatforms');
  const repeatEnabled = watch('repeatEnabled');
  const eventDriven = isEventTrigger(watch('trigger'));

  // Errors stay hidden on a pristine form and appear only once the user
  // attempts Save; from then on they track validation live (mirrors the
  // script form's `showErrors` contract).
  const [showErrors, setShowErrors] = useState(false);

  // Reordering: dnd-kit, same sensors as the core library's board. The pointer
  // sensor needs a small activation distance so a click on the handle (or a
  // touch-scroll started over it) isn't read as a drag; the keyboard sensor is
  // what makes the handle a real drag control for non-pointer users.
  const sortableIds = useMemo(() => fields.map(field => field.id), [fields]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const from = sortableIds.indexOf(String(active.id));
      const to = sortableIds.indexOf(String(over.id));
      if (from !== -1 && to !== -1) move(from, to);
    },
    [sortableIds, move],
  );

  // Live-region announcements. The array only changes on drop, so an id's
  // position is its index in `sortableIds` throughout the gesture.
  const dragAnnouncements = useMemo<Announcements>(() => {
    const label = (id: string | number) => {
      const index = sortableIds.indexOf(String(id));
      const name = methods.getValues(`scripts.${index}.name`);
      return { position: index + 1, name: name || `script ${index + 1}` };
    };
    const total = sortableIds.length;
    return {
      onDragStart: ({ active }) => {
        const { name, position } = label(active.id);
        return `Picked up ${name}. It is in position ${position} of ${total}.`;
      },
      onDragOver: ({ over }) => (over ? `Moved to position ${label(over.id).position} of ${total}.` : undefined),
      onDragEnd: ({ over }) =>
        over
          ? `Dropped in position ${label(over.id).position} of ${total}.`
          : 'Reorder cancelled. The script stayed in its original position.',
      onDragCancel: ({ active }) =>
        `Reorder cancelled. ${label(active.id).name} stayed in position ${label(active.id).position} of ${total}.`,
    };
  }, [sortableIds, methods]);

  // Seed once the gated schedule arrives; guarded on `!isDirty` so the
  // `store-and-network` second delivery never clobbers in-progress edits.
  useEffect(() => {
    if (initialValues && !formState.isDirty) {
      methods.reset(initialValues);
    }
  }, [initialValues, formState.isDirty, methods]);

  const backFallback =
    isEditMode && scheduleId ? routes.scriptsV2.schedules.details(scheduleId) : routes.scriptsV2.schedules.list;

  const togglePlatform = useCallback(
    (platform: string) => {
      const current = methods.getValues('supportedPlatforms');
      const has = current.includes(platform);
      // Allow deselecting any item, including the last one — the "at least one
      // platform" rule is enforced by validation on submit (mirrors the script form).
      methods.setValue('supportedPlatforms', has ? current.filter(p => p !== platform) : [...current, platform], {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [methods],
  );

  const onSubmit = useCallback(
    (data: EditScheduleFormData) => {
      // An event-driven schedule carries no timing at all — the backend keeps
      // both fields null for DEVICE_ONLINE, so never send a stale start/repeat
      // left over from a schedule that used to be time-driven.
      const isEventDriven = isEventTrigger(data.trigger);
      // Day + time of day become one instant here. Both are guaranteed present
      // for a DATE_TIME schedule (schema `superRefine`), so a null start can
      // only mean "event-driven".
      const startAt =
        !isEventDriven && data.scheduledDate && data.scheduledTime
          ? toScheduleInstant(applyTimeSlot(data.scheduledDate, data.scheduledTime))
          : null;
      const input = {
        name: data.name,
        // PUT semantics on update: null clears the stored description.
        description: data.description.trim() || null,
        supportedPlatforms: platformsToEnums(data.supportedPlatforms),
        // Order is the payload: the card order (drag & drop) IS the run order.
        // TODO(backend): per-script timeout / args / env vars are edited in the
        // cards but dropped here — the input takes bare ids until it grows
        // `scriptEntries` (docs/script-schedules-v2-graphql-gaps.md §3).
        scriptIds: data.scripts.map(s => s.scriptId),
        trigger: data.trigger,
        // PUT semantics: null clears the timing / recurrence. `repeat` needs a
        // start to anchor it, which a DATE_TIME schedule always has by now.
        startAt,
        // `resolveRepeatSeconds`, not the raw parts: a stored cadence the unit
        // dropdown can't express is displayed rounded, and writing that display
        // back would change how often the schedule runs on an edit that never
        // touched recurrence.
        repeat:
          startAt && data.repeatEnabled
            ? resolveRepeatSeconds(data.repeatInterval, data.repeatUnit, data.repeatSecondsStored)
            : null,
      };

      if (isEditMode && scheduleId) {
        commitUpdate({
          variables: { input: { id: scheduleId, ...input } },
          onCompleted: () => {
            toast({
              title: 'Schedule updated',
              description: `Schedule "${data.name}" updated successfully.`,
              variant: 'success',
            });
            safeBackOrReplace(router, routes.scriptsV2.schedules.details(scheduleId));
          },
          onError: error => {
            toast({
              title: 'Update failed',
              description: getRelayErrorMessage(error, 'Failed to update schedule'),
              variant: 'destructive',
            });
          },
        });
      } else {
        commitCreate({
          variables: { input },
          onCompleted: response => {
            toast({
              title: 'Schedule created',
              description: `Schedule "${data.name}" created successfully.`,
              variant: 'success',
            });
            // "Save & Continue" — the schedule exists but runs on nothing until
            // devices are assigned, so the create flow continues straight into
            // the assignment step. `replace`: the schedule is created, going
            // Back into the create form would only re-create it.
            router.replace(routes.scriptsV2.schedules.devices(response.createScriptSchedule.id));
          },
          onError: error => {
            toast({
              title: 'Creation failed',
              description: getRelayErrorMessage(error, 'Failed to create schedule'),
              variant: 'destructive',
            });
          },
        });
      }
    },
    [isEditMode, scheduleId, commitCreate, commitUpdate, toast, router],
  );

  const onInvalid = useCallback(() => {
    toast({
      title: 'Validation Error',
      description: 'Please fix the highlighted fields before saving.',
      variant: 'destructive',
    });
    // The offending field is usually scrolled off-screen by now — take the user to it.
    scrollToFirstInvalidField();
  }, [toast]);

  const handleSave = useCallback(() => {
    setShowErrors(true);
    return handleSubmit(onSubmit, onInvalid)();
  }, [handleSubmit, onSubmit, onInvalid]);

  const actions = useMemo<PageActionButton[]>(
    () => [
      {
        label: isEditMode ? 'Update Schedule' : 'Save & Continue',
        onClick: handleSave,
        variant: 'accent' as const,
        disabled: loading || isSaving,
        loading: isSaving,
      },
    ],
    [isEditMode, handleSave, loading, isSaving],
  );

  return (
    <FormProvider {...methods}>
      <ScriptPageChrome
        title={isEditMode ? 'Edit Script Schedule' : 'New Script Schedule'}
        backFallback={backFallback}
        actions={actions}
        actionsVariant="primary-buttons"
        showMobileCancel
      >
        <div className="flex flex-col gap-[var(--spacing-system-lf)]">
          {/* Schedule Name */}
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Schedule Name</Label>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Input
                  placeholder="Enter schedule name"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={loading}
                  className="w-full"
                  error={showErrors ? fieldState.error?.message : undefined}
                  invalid={showErrors && !!fieldState.error}
                />
              )}
            />
          </div>

          {/* Note (backend `description`) */}
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Note</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  placeholder="Enter note here (optional)"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={loading}
                  className="w-full min-h-[96px]"
                />
              )}
            />
          </div>

          {/* Trigger — what fires the schedule. DEVICE_ONLINE is event-driven
              and carries no timing, so picking it hides the Date & Time row. */}
          <Controller
            name="trigger"
            control={control}
            render={({ field }) => (
              <RadioGroupBlock
                variant="grouped"
                value={field.value}
                onValueChange={field.onChange}
                disabled={loading}
                options={TRIGGER_OPTIONS}
              />
            )}
          />

          {/* Date | Time | Repeat | Repeat in. `scheduledDate` + `scheduledTime`
              combine into the backend's `startAt` (30-min boundary, enforced by
              the Time slots) and are both required here; the repeat toggle +
              interval + unit → `repeat` seconds.

              Only DATE_TIME schedules have timing, so the row collapses when the
              event trigger is picked. It stays MOUNTED (a toggle back restores
              what was typed) and animates with the `0fr → 1fr` grid-rows
              technique — the portable way to transition to an intrinsic height,
              since `interpolate-size` / `calc-size()` still aren't cross-browser.
              `inert` drops the collapsed fields out of the tab order and the
              accessibility tree.

              The `overflow-hidden` the technique requires also clips anything
              hanging below the fields — and field errors are absolutely
              positioned there (out of flow, so showing one never reflows the
              form). The bottom padding is the room they render into; the
              constant negative margin cancels it again, so the spacing below the
              row is unchanged and a COLLAPSED row still leaves no 24px hole
              (a 0fr track zeroes the padding too — `border-box`). */}
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
                      // The core picker has no clear affordance, so the design's
                      // xmark rides on top of the trigger's free right edge.
                      <div className="relative">
                        <DatePickerInputSimple
                          placeholder="Select date"
                          value={field.value ?? undefined}
                          onChange={date => field.onChange(date ?? null)}
                          disabled={loading}
                          className="w-full"
                          error={showErrors ? fieldState.error?.message : undefined}
                          invalid={showErrors && !!fieldState.error}
                        />
                        {field.value && !loading && (
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
                      // `''` reads as "no selection" to Radix, so the placeholder
                      // shows until a slot is picked — a date at midnight no
                      // longer masquerades as a chosen 12:00 AM.
                      <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                        {/* No `border-ods-border` here: the trigger already sets
                            it, and a repeat of it in `className` lands AFTER the
                            invalid branch in the component's `cn()`, so
                            tailwind-merge would drop the error border. */}
                        <SelectTrigger
                          className="w-full"
                          error={showErrors ? fieldState.error?.message : undefined}
                          invalid={showErrors && !!fieldState.error}
                        >
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOT_OPTIONS.map(opt => (
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
                        disabled={loading}
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
                          min={1}
                          className="w-full"
                          value={String(field.value ?? '')}
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 1)}
                          disabled={loading || !repeatEnabled}
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
                        <Select value={field.value} onValueChange={field.onChange} disabled={loading || !repeatEnabled}>
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

          {/* Supported Platforms. The min-1 error overlays the section gap below
              the row (same absolute pattern as the script form) — no layout shift. */}
          {/* `data-invalid`: the block has no input of its own, so it carries the
              marker itself — that is what `scrollToFirstInvalidField` looks for. */}
          <div
            className="relative flex flex-col gap-[var(--spacing-system-xxs)]"
            data-invalid={(showErrors && !!formState.errors.supportedPlatforms) || undefined}
          >
            <Label className="text-h4">Supported Platform</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--spacing-system-mf)]">
              {AVAILABLE_PLATFORMS.map(platform => {
                const isDisabled = loading || DISABLED_PLATFORMS.includes(platform.id);
                const comingSoon = DISABLED_PLATFORMS.includes(platform.id);
                return (
                  <SelectButton
                    key={platform.id}
                    title={platform.name}
                    icon={<platform.icon className="w-5 h-5" />}
                    selected={!comingSoon && supportedPlatforms.includes(platform.id)}
                    disabled={isDisabled}
                    tag={comingSoon ? (isMdUp ? 'Coming Soon' : 'Soon') : undefined}
                    onClick={isDisabled ? undefined : () => togglePlatform(platform.id)}
                  />
                );
              })}
            </div>
            {showErrors && formState.errors.supportedPlatforms && (
              <div className="absolute bottom-0 left-0 right-0 translate-y-full">
                <TruncateText variant="h6" className="text-ods-error">
                  {formState.errors.supportedPlatforms.message ?? ''}
                </TruncateText>
              </div>
            )}
          </div>

          {/* Scheduled Scripts — the ordered list; card order is the run order. */}
          <div className="flex flex-col gap-[var(--spacing-system-lf)]">
            <div className="flex items-end min-h-[72px] pt-[var(--spacing-system-l)]">
              <h2 className="text-h2 text-ods-text-primary">Scheduled Scripts</h2>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
              accessibility={{ announcements: dragAnnouncements, screenReaderInstructions: dragInstructions }}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-[var(--spacing-system-lf)]">
                  {fields.map((field, index) => (
                    <ScheduleScriptPickerCard
                      key={field.id}
                      id={field.id}
                      index={index}
                      supportedPlatforms={supportedPlatforms}
                      onRemove={() => remove(index)}
                      canRemove={fields.length > 1}
                      disabled={loading}
                      showErrors={showErrors}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() => append(EMPTY_SCRIPT_ROW)}
              disabled={loading}
              className="self-start"
              leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
            >
              Add Script
            </Button>
          </div>
        </div>
      </ScriptPageChrome>
    </FormProvider>
  );
}

/** Maps the gated schedule (`undefined` while loading) to the form's seed props. */
function LoadedEditScheduleForm({
  scheduleId,
  schedule,
}: {
  scheduleId: string;
  schedule: ScheduleDetailData | undefined;
}) {
  const initialValues = useMemo(() => (schedule ? scheduleToFormValues(schedule) : null), [schedule]);
  return <EditScheduleForm scheduleId={scheduleId} initialValues={initialValues} loading={schedule === undefined} />;
}

interface EditSchedulePageProps {
  scheduleId: string | null;
}

/**
 * Create + edit page for a schedule (v2, Relay). Create renders the form
 * directly; edit wraps it in {@link ScheduleDetailGate} so the form renders
 * once (disabled) and the schedule pours in — no skeleton swap, no remount.
 */
export function EditSchedulePage({ scheduleId }: EditSchedulePageProps) {
  if (!scheduleId) {
    return <EditScheduleForm scheduleId={null} initialValues={null} />;
  }

  return (
    <ScheduleDetailGate scheduleId={scheduleId}>
      {schedule => <LoadedEditScheduleForm scheduleId={scheduleId} schedule={schedule} />}
    </ScheduleDetailGate>
  );
}
