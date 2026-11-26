'use client';
'use no memo';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { NEXT_RUN_NOTE } from '../hooks/use-check-mutations';
import { formatOverrideThreshold, INSIGHT_CHECK_PLATFORM_LABELS } from '../utils/check-labels';
import type { Check, CheckOverride } from '../utils/check-transform';
import { ThresholdFields, thresholdsByParameter, thresholdsSchema, type ThresholdValues } from './threshold-fields';

/** "Exceptions keep their own values: lab (above 60), kiosk (above 25)." Nothing when no exception sets a threshold. */
function overridesNote(check: Check, overrides: readonly CheckOverride[]): string {
  const withValues = overrides.flatMap(override => {
    if (Object.keys(override.parameters).length === 0 || override.enabled === false) return [];
    const threshold = formatOverrideThreshold(check, override);
    return [`${override.name ?? 'a removed scope'} (${threshold.charAt(0).toLowerCase()}${threshold.slice(1)})`];
  });
  return withValues.length > 0 ? `Exceptions keep their own values: ${withValues.join(', ')}. ` : '';
}

interface EditDefaultModalProps {
  check: Check;
  /** The check's exceptions, to say which keep their own values; null while they load. */
  overrides: readonly CheckOverride[] | null;
  isSaving: boolean;
  onClose: () => void;
  /** Every threshold of the new default, by parameter key. */
  onSave: (thresholds: Record<string, number>) => void;
}

/** The check's default thresholds: what every device without an exception is measured against. */
export function EditDefaultModal({ check, overrides, isSaving, onClose, onSave }: EditDefaultModalProps) {
  const form = useForm<ThresholdValues>({
    resolver: zodResolver(z.object({ thresholds: thresholdsSchema(check.parameters) })),
    defaultValues: { thresholds: check.parameters.map(parameter => String(parameter.value)) },
  });
  const submit = form.handleSubmit(values => onSave(thresholdsByParameter(check.parameters, values.thresholds)));
  const platform = INSIGHT_CHECK_PLATFORM_LABELS[check.platform as keyof typeof INSIGHT_CHECK_PLATFORM_LABELS];

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title="Edit Default"
      className="text-left md:max-w-[600px]"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="button" variant="accent" loading={isSaving} onClick={submit} className="flex-1">
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-[var(--spacing-system-l)]"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-ods-text-secondary text-h6">
          {[check.name, platform].filter(Boolean).join(' · ')} · used by every device without an exception.
        </p>
        <ThresholdFields
          parameters={check.parameters}
          control={form.control}
          errors={form.formState.errors}
          defaultOf={parameter => parameter.defaultValue}
        />
        <p className="text-ods-text-secondary text-h6">
          {overrides ? overridesNote(check, overrides) : ''}
          {NEXT_RUN_NOTE}
        </p>
      </form>
    </SimpleModal>
  );
}
