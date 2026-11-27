import { z } from 'zod';
import { InsightThresholdDirection } from '@/generated/schema-enums';
import type { CheckParameter } from './check-transform';

/** Each threshold a whole number within its parameter's bounds, one text value per parameter in the check's order. */
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

/** The thresholds part of a form. */
export type ThresholdValues = { thresholds: z.infer<ReturnType<typeof thresholdsSchema>> };

/** The form's text values as numbers by parameter key. */
export function thresholdsByParameter(
  parameters: readonly CheckParameter[],
  values: readonly string[],
): Record<string, number> {
  return Object.fromEntries(parameters.map((parameter, index) => [parameter.parameter, Number(values[index])]));
}

/** `Opens an incident above this value. Default: 40.` The accepted range is the error's to say. */
export function thresholdHint(parameter: CheckParameter, defaultValue: number): string {
  const side = parameter.firesWhen === InsightThresholdDirection.BELOW ? 'below' : 'above';
  return `Opens an incident ${side} this value. Default: ${defaultValue}.`;
}

/**
 * The toast for a save the thresholds refuse: what the wrong values need (each field says it under itself too), so a
 * press on Save never does nothing.
 */
export function invalidThresholdsToast(errors: { thresholds?: unknown }) {
  const fields = errors.thresholds && typeof errors.thresholds === 'object' ? Object.values(errors.thresholds) : [];
  const messages = [
    ...new Set(
      fields.flatMap(field =>
        field && typeof field === 'object' && 'message' in field && typeof field.message === 'string'
          ? [field.message]
          : [],
      ),
    ),
  ];
  return {
    title: 'Check the thresholds',
    description: messages.length > 0 ? `${messages.join('. ')}.` : 'A threshold is out of range.',
    variant: 'destructive' as const,
  };
}
