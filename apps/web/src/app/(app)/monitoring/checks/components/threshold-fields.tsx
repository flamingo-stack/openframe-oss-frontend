'use client';
'use no memo';

import { Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type Control, Controller, type FieldErrors, type FieldValues, type Path } from 'react-hook-form';
import { parameterUnitSuffix } from '../utils/check-labels';
import type { CheckParameter } from '../utils/check-transform';
import { thresholdHint, type ThresholdValues } from '../utils/threshold-form';

interface ThresholdFieldsProps<T extends FieldValues & ThresholdValues> {
  parameters: readonly CheckParameter[];
  control: Control<T>;
  errors: FieldErrors<ThresholdValues>;
  /** The default a field's hint names: the built-in value (editing the default) or the check's default (an exception). */
  defaultOf: (parameter: CheckParameter) => number;
}

/** One labelled number field per threshold, its unit inside the field and the rule under it. */
export function ThresholdFields<T extends FieldValues & ThresholdValues>({
  parameters,
  control,
  errors,
  defaultOf,
}: ThresholdFieldsProps<T>) {
  const fields = parameters.map((parameter, index) => {
    const error = errors.thresholds?.[index]?.message;
    return (
      <div key={parameter.parameter} className="flex flex-col gap-[var(--spacing-system-xs)]">
        <Label className="text-ods-text-primary text-h4">{parameter.label}</Label>
        <Controller
          control={control}
          name={`thresholds.${index}` as Path<T>}
          render={({ field }) => (
            <Input
              type="number"
              inputMode="numeric"
              min={parameter.min}
              max={parameter.max}
              step={1}
              value={field.value}
              onChange={event => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              invalid={Boolean(error)}
              endAdornment={parameterUnitSuffix(parameter.unit)}
              aria-label={parameter.label}
            />
          )}
        />
        <span className={error ? 'text-ods-error text-h6' : 'text-ods-text-secondary text-h6'}>
          {error ?? thresholdHint(parameter, defaultOf(parameter))}
        </span>
      </div>
    );
  });
  if (parameters.length < 2) return fields;
  return (
    <>
      {fields}
      <span className="text-ods-text-secondary text-h6">An incident opens when either value is crossed.</span>
    </>
  );
}
