/**
 * What the UI shows for a value the record does not have — a missing date, an
 * unknown version, an empty count. One constant, so every screen draws the
 * same mark; `EmptyValue` / `InfoCell` / `ValueText` draw it muted.
 */
export const EMPTY_VALUE = '—';

/** Whether a value is missing: nothing, blank, or already the empty mark (a formatter's answer for "none"). */
export function isEmptyValue(value: unknown): value is null | undefined | '' {
  return value == null || value === '' || value === EMPTY_VALUE;
}

/** A value as text, or {@link EMPTY_VALUE} when it is missing — for text that is not drawn (toasts, copied text). */
export function displayValue(value: string | number | null | undefined): string {
  return isEmptyValue(value) ? EMPTY_VALUE : String(value);
}
