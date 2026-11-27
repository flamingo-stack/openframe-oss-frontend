'use client';
'use no memo';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { INSIGHT_CHECK_PLATFORM_LABELS } from '../utils/check-labels';
import { exceptionsKeepTheirValues, NEXT_RUN_NOTE } from '../utils/check-messages';
import type { Check, CheckOverride } from '../utils/check-transform';
import {
  invalidThresholdsToast,
  thresholdsByParameter,
  thresholdsSchema,
  type ThresholdValues,
} from '../utils/threshold-form';
import { ThresholdFields } from './threshold-fields';

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
  const { toast } = useToast();
  const submit = form.handleSubmit(
    values => onSave(thresholdsByParameter(check.parameters, values.thresholds)),
    errors => toast(invalidThresholdsToast(errors)),
  );
  const platform = INSIGHT_CHECK_PLATFORM_LABELS[check.platform as keyof typeof INSIGHT_CHECK_PLATFORM_LABELS];

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title="Edit Default"
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
          {overrides ? exceptionsKeepTheirValues(check, overrides) : ''}
          {NEXT_RUN_NOTE}
        </p>
      </form>
    </SimpleModal>
  );
}
