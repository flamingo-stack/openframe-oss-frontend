'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'react-relay';
import type { createScriptScheduleMutation as CreateScheduleMutationType } from '@/__generated__/createScriptScheduleMutation.graphql';
import type { updateScriptScheduleMutation as UpdateScheduleMutationType } from '@/__generated__/updateScriptScheduleMutation.graphql';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { ScheduleOfflineBehavior } from '@/generated/schema-enums';
import { createScriptScheduleMutation } from '@/graphql/scripts/create-script-schedule-mutation';
import { updateScriptScheduleMutation } from '@/graphql/scripts/update-script-schedule-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import { platformsToEnums } from '../../shared/utils/script-mappers';
import {
  DEFAULT_SCHEDULE_VALUES,
  type EditScheduleFormData,
  editScheduleFormSchema,
} from '../types/edit-schedule.types';
import { collectScriptCustomParams } from '../utils/schedule-script-params';
import {
  applyTimeSlot,
  isDeviceLocalTime,
  isEventTrigger,
  isRetryOnReconnect,
  resolveDurationSeconds,
  toScheduleInstant,
} from '../utils/schedule-timing';

interface UseEditScheduleFormOptions {
  /** `null` on the create page — which is also what picks create over update. */
  scheduleId: string | null;
}

/**
 * Form state, validation and the create / update mutation for a script schedule.
 *
 * The form starts empty and is filled by the page through `useSeedForm` once the
 * record arrives — the fields are mounted (and locked) from the first render, so
 * there is no skeleton copy of this form to keep in step.
 */
export function useEditScheduleForm({ scheduleId }: UseEditScheduleFormOptions) {
  const isEditMode = Boolean(scheduleId);
  const router = useRouter();
  const { toast } = useToast();

  const [commitCreate, isCreating] = useMutation<CreateScheduleMutationType>(createScriptScheduleMutation);
  const [commitUpdate, isUpdating] = useMutation<UpdateScheduleMutationType>(updateScriptScheduleMutation);
  const isSaving = isCreating || isUpdating;

  const methods = useForm<EditScheduleFormData>({
    resolver: zodResolver(editScheduleFormSchema),
    defaultValues: DEFAULT_SCHEDULE_VALUES,
    // Nothing is judged mid-word. The default pair is `onSubmit` + re-validate
    // `onChange`, which means that after ONE failed Save every later keystroke
    // is graded — the half-typed "3" of "30" reads as below the minimum, and the
    // number fields flash a complaint about a value still being written. Blur is
    // when a value is finished, and it is also when the cross-field rule (window
    // shorter than cadence) can weigh two settled numbers rather than one
    // settled and one in progress.
    reValidateMode: 'onBlur',
  });

  // Errors stay hidden on a pristine form and appear only once the user attempts
  // Save; from then on they track validation live (mirrors the script form's
  // `showErrors` contract).
  const [showErrors, setShowErrors] = useState(false);

  const onSubmit = useCallback(
    (data: EditScheduleFormData) => {
      // An event-driven schedule carries no timing at all — the backend keeps
      // both fields null for DEVICE_ONLINE, so never send a stale start/repeat
      // left over from a schedule that used to be time-driven.
      const isEventDriven = isEventTrigger(data.trigger);
      // Day + time of day become one instant here. Both are guaranteed present
      // for a DATE_TIME schedule (schema `superRefine`), so a null start can only
      // mean "event-driven".
      // Written under the reading the form holds: SERVER converts the local pair
      // to the instant it names, DEVICE_LOCAL stores the wall clock itself for
      // the runner to re-base per device (see `toScheduleInstant`).
      const startAt =
        !isEventDriven && data.scheduledDate && data.scheduledTime
          ? toScheduleInstant(applyTimeSlot(data.scheduledDate, data.scheduledTime), data.timeReference)
          : null;
      // A device-local start is one-shot by contract — the schema does not take
      // `repeat` for it. The Repeat controls are cleared and locked when it is
      // picked, so this only backs that up; what it does guarantee is that a
      // cadence can never ride along with a reading that cannot carry one.
      const deviceLocal = isDeviceLocalTime(data.timeReference);
      // The window is written only when the behavior that uses it is in force,
      // and an event-driven schedule has neither.
      const retriesOnReconnect = !isEventDriven && isRetryOnReconnect(data.offlineBehavior);
      const input = {
        name: data.name,
        // PUT semantics on update: null clears the stored description.
        description: data.description.trim() || null,
        supportedPlatforms: platformsToEnums(data.supportedPlatforms),
        // Order is the payload: the card order (drag & drop) IS the run order.
        // TODO(backend): per-script TIMEOUT is still edited in the cards and
        // dropped here — `ScheduledScriptCustomParamsInput` carries args and env
        // vars only.
        scriptIds: data.scripts.map(s => s.scriptId),
        // Sparse by construction: a script whose args and env vars still equal
        // its own defaults contributes no entry, so the schedule keeps
        // inheriting later edits to that script. PUT semantics on update — this
        // array IS the stored set, and an empty one clears every override, which
        // is exactly what "the user reset both halves" has to mean.
        scriptCustomParams: collectScriptCustomParams(data.scripts),
        trigger: data.trigger,
        // PUT semantics: null clears the timing / recurrence. `repeat` needs a
        // start to anchor it, which a DATE_TIME schedule always has by now.
        startAt,
        // Which clock `startAt` is in. Sent explicitly rather than left to the
        // input's null-means-SERVER default: this is a PUT, and the form holds
        // the schedule's own reading even where the picker is hidden by its
        // flag — omitting it would re-time a device-local schedule on any edit.
        timeReference: data.timeReference,
        // `resolveDurationSeconds`, not the raw parts: a stored cadence the unit
        // dropdown can't express is displayed rounded, and writing that display
        // back would change how often the schedule runs on an edit that never
        // touched recurrence.
        // `data.repeatInterval` is nullable so the box can be emptied while
        // typing; validation has already refused a null one by the time a
        // repeating schedule reaches here, so the guard is only for the type.
        repeat:
          startAt && !deviceLocal && data.repeatEnabled && data.repeatInterval !== null
            ? resolveDurationSeconds(data.repeatInterval, data.repeatUnit, data.repeatSecondsStored)
            : null,
        // "If device is offline at scheduled time" — meaningless without one, so
        // an event-driven schedule is written back as the SKIP default rather
        // than carrying whatever the collapsed block still holds. It fires ON
        // the reconnect already; there is no offline moment to decide about.
        offlineBehavior: isEventDriven ? ScheduleOfflineBehavior.SKIP : data.offlineBehavior,
        // Only ever set alongside RETRY_ON_RECONNECT — the schema says the field
        // is "set only when offlineBehavior is RETRY_ON_RECONNECT; null/ignored
        // for SKIP", and PUT semantics make sending a stale window on a schedule
        // switched back to SKIP a stored value nothing displays.
        //
        // `resolveDurationSeconds` for the same reason `repeat` uses it, and
        // more sharply: this field sits on no grid, so a window the unit
        // dropdown genuinely cannot express is reachable, and writing the
        // rounded display back would shorten it on an unrelated edit.
        reconnectWindowSeconds:
          retriesOnReconnect && data.reconnectInterval !== null
            ? resolveDurationSeconds(data.reconnectInterval, data.reconnectUnit, data.reconnectWindowSecondsStored)
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
            safeBackOrReplace(router, routes.scripts.schedules.details(scheduleId));
          },
          onError: error => {
            toast({
              title: 'Update failed',
              description: getRelayErrorMessage(error, 'Failed to update schedule'),
              variant: 'destructive',
            });
          },
        });
        return;
      }

      commitCreate({
        variables: { input },
        onCompleted: response => {
          toast({
            title: 'Schedule created',
            description: `Schedule "${data.name}" created successfully.`,
            variant: 'success',
          });
          // "Save & Continue" — the schedule exists but runs on nothing until
          // devices are assigned, so the create flow continues straight into the
          // assignment step. `replace`: the schedule is created, going Back into
          // the create form would only re-create it.
          router.replace(routes.scripts.schedules.devices(response.createScriptSchedule.id));
        },
        onError: error => {
          toast({
            title: 'Creation failed',
            description: getRelayErrorMessage(error, 'Failed to create schedule'),
            variant: 'destructive',
          });
        },
      });
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
    return methods.handleSubmit(onSubmit, onInvalid)();
  }, [methods, onSubmit, onInvalid]);

  const backFallback =
    isEditMode && scheduleId ? routes.scripts.schedules.details(scheduleId) : routes.scripts.schedules.list;

  return { methods, showErrors, handleSave, isSaving, isEditMode, backFallback };
}
