'use client';

import { SelectButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  Input,
  Label,
  RadioGroupBlock,
  Textarea,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '../../shared/utils/script-utils';
import { type EditScheduleFormData, TRIGGER_OPTIONS } from '../types/edit-schedule.types';
import { isEventTrigger } from '../utils/schedule-timing';
import { ScheduleOfflineFields } from './schedule-offline-fields';
import { ScheduleScriptsField } from './schedule-scripts-field';
import { ScheduleTimingFields } from './schedule-timing-fields';

interface ScheduleFormFieldsProps {
  showErrors: boolean;
  /**
   * Locks every control. This is the edit page's loading state: the real fields,
   * in the geometry they will keep, with nothing in them yet — so there is no
   * placeholder to swap for them when the schedule lands.
   */
  disabled?: boolean;
}

/**
 * Every field of the schedule form, in the order the design has them. Reads the
 * form off context, so the page around it only owns the chrome and the Save.
 */
export function ScheduleFormFields({ showErrors, disabled = false }: ScheduleFormFieldsProps) {
  const { control, formState, getValues, setValue } = useFormContext<EditScheduleFormData>();
  const isMdUp = useMdUp();
  const supportedPlatforms = useWatch({ control, name: 'supportedPlatforms' });
  const trigger = useWatch({ control, name: 'trigger' });

  // The DEVICE_ONLINE trigger is flag-gated. With the flag off there is only one
  // way to fire a schedule, and a radio group holding a single option is pure
  // ceremony — the whole block goes, and the form writes DATE_TIME (its default)
  // for every schedule.
  //
  // `useFeatureFlagGate`, not `useFeatureFlag`: flags are uncached, so an
  // unanswered flag is not "off". Reading it as off here would hide the choice on
  // a tenant that has it and then pop it in mid-edit. While the answer is out the
  // block renders as the LOCKED real control — the same state the fields are in
  // while the schedule loads.
  const deviceOnlineGate = useFeatureFlagGate('script-schedule-device-online');

  // One exception to the hide, and it is about not stranding the user rather
  // than about the feature: a schedule already STORED as event-driven keeps its
  // trigger visible even where the flag is off. Hiding it there would leave the
  // form showing no timing and no reason why, with Save quietly writing the
  // event trigger back — the control is what names the state and offers the way
  // out of it.
  const showTrigger = deviceOnlineGate !== 'off' || isEventTrigger(trigger);

  const togglePlatform = useCallback(
    (platform: string) => {
      const current = getValues('supportedPlatforms');
      const has = current.includes(platform);
      // Allow deselecting any item, including the last one — the "at least one
      // platform" rule is enforced by validation on submit (mirrors the script form).
      setValue('supportedPlatforms', has ? current.filter(p => p !== platform) : [...current, platform], {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [getValues, setValue],
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
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
              disabled={disabled}
              className="w-full"
              error={showErrors ? fieldState.error?.message : undefined}
              invalid={showErrors && !!fieldState.error}
            />
          )}
        />
      </div>

      {/* "Note" in the UI, `description` on the backend. */}
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
              disabled={disabled}
              className="w-full min-h-[96px]"
            />
          )}
        />
      </div>

      {/* What fires the schedule. DEVICE_ONLINE is event-driven and carries no
          timing, so picking it collapses the Date & Time row below. Absent
          entirely where the flag is off — see `showTrigger`. */}
      {showTrigger && (
        <Controller
          name="trigger"
          control={control}
          render={({ field }) => (
            <RadioGroupBlock
              variant="grouped"
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled || deviceOnlineGate === 'loading'}
              options={TRIGGER_OPTIONS}
            />
          )}
        />
      )}

      {/* The min-1 error overlays the section gap below the row (same absolute
          pattern as the script form) — no layout shift. `data-invalid`: the block
          has no input of its own, so it carries the marker itself, which is what
          `scrollToFirstInvalidField` looks for. */}
      <div
        className="relative flex flex-col gap-[var(--spacing-system-xxs)]"
        data-invalid={(showErrors && !!formState.errors.supportedPlatforms) || undefined}
      >
        <Label className="text-h4">Supported Platform</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--spacing-system-mf)]">
          {AVAILABLE_PLATFORMS.map(platform => {
            const comingSoon = DISABLED_PLATFORMS.includes(platform.id);
            return (
              <SelectButton
                key={platform.id}
                title={platform.name}
                icon={<platform.icon className="w-5 h-5" />}
                selected={!comingSoon && supportedPlatforms.includes(platform.id)}
                disabled={comingSoon || disabled}
                tag={comingSoon ? (isMdUp ? 'Coming Soon' : 'Soon') : undefined}
                onClick={comingSoon || disabled ? undefined : () => togglePlatform(platform.id)}
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

      <ScheduleTimingFields showErrors={showErrors} disabled={disabled} />

      {/* Hangs off the same answer as the timing above it — "if device is
          offline at scheduled time" presupposes one — so it collapses for the
          event trigger too, and the two blocks animate together. */}
      <ScheduleOfflineFields showErrors={showErrors} disabled={disabled} />

      <ScheduleScriptsField showErrors={showErrors} disabled={disabled} />
    </div>
  );
}
