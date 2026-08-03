'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'react-relay';
import type { createScriptScheduleMutation as CreateScheduleMutationType } from '@/__generated__/createScriptScheduleMutation.graphql';
import type { updateScriptScheduleMutation as UpdateScheduleMutationType } from '@/__generated__/updateScriptScheduleMutation.graphql';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
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
import { applyTimeSlot, isEventTrigger, resolveRepeatSeconds, toScheduleInstant } from '../utils/schedule-timing';

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
    isEditMode && scheduleId ? routes.scriptsV2.schedules.details(scheduleId) : routes.scriptsV2.schedules.list;

  return { methods, showErrors, handleSave, isSaving, isEditMode, backFallback };
}
