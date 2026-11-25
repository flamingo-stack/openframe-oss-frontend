'use client';
'use no memo';

import { Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type Control, Controller, type FieldErrors, type FieldValues, type Path } from 'react-hook-form';
import { z } from 'zod';
import { InsightThresholdDirection } from '@/generated/schema-enums';
import { parameterUnitSuffix } from '../utils/check-labels';
import type { CheckParameter } from '../utils/check-transform';

/** The thresholds part of a form: one text value per parameter, in the check's order. */
export type ThresholdValues = { thresholds: string[] };

/** Each threshold a whole number within its parameter's bounds. */
export function thresholdsSchema(parameters: readonly CheckParameter[]) {
  return z.array(z.string()).superRefine((values, ctx) => {
    values.forEach((text, index) => {
      const parameter = parameters[index];
      if (!parameter) return;
      const value = Number(text);
      if (text.trim() === '' || !Number.isInteger(value) || value < parameter.min || value > parameter.max) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: `Enter a whole number from ${parameter.min} to ${parameter.max}`,
        });
      }
    });
  });
}

/** `Opens an incident above this value. From 5 to 300. Default: 40.` */
function thresholdHint(parameter: CheckParameter, defaultValue: number, withRange: boolean): string {
  const side = parameter.firesWhen === InsightThresholdDirection.BELOW ? 'below' : 'above';
  const range = withRange ? ` From ${parameter.min} to ${parameter.max}.` : '';
  return `Opens an incident ${side} this value.${range} Default: ${defaultValue}.`;
}

interface ThresholdFieldsProps<T extends FieldValues & ThresholdValues> {
  parameters: readonly CheckParameter[];
  control: Control<T>;
  errors: FieldErrors<ThresholdValues>;
  /** The default a field's hint names: the built-in value (editing the default) or the check's default (an override). */
  defaultOf: (parameter: CheckParameter) => number;
  /** Whether the hint names the accepted range (Add Override does; the edit forms leave it to the error). */
  withRange?: boolean;
  disabled?: boolean;
}

/** One labelled number field per threshold, its unit inside the field and the rule under it. */
export function ThresholdFields<T extends FieldValues & ThresholdValues>({
  parameters,
  control,
  errors,
  defaultOf,
  withRange = true,
  disabled,
}: ThresholdFieldsProps<T>) {
  return parameters.map((parameter, index) => {
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
              disabled={disabled}
              invalid={Boolean(error)}
              endAdornment={parameterUnitSuffix(parameter.unit)}
              aria-label={parameter.label}
            />
          )}
        />
        <span className={error ? 'text-ods-error text-h6' : 'text-ods-text-secondary text-h6'}>
          {error ?? thresholdHint(parameter, defaultOf(parameter), withRange)}
        </span>
      </div>
    );
  });
}

/** The form's text values as numbers by parameter key. */
export function thresholdsByParameter(
  parameters: readonly CheckParameter[],
  values: readonly string[],
): Record<string, number> {
  return Object.fromEntries(parameters.map((parameter, index) => [parameter.parameter, Number(values[index])]));
}
