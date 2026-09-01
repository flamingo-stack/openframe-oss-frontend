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
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '../../shared/utils/script-utils';
import { type EditScheduleFormData, TRIGGER_OPTIONS } from '../types/edit-schedule.types';
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
          timing, so picking it collapses the Date & Time row below. */}
      <Controller
        name="trigger"
        control={control}
        render={({ field }) => (
          <RadioGroupBlock
            variant="grouped"
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
            options={TRIGGER_OPTIONS}
          />
        )}
      />

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
