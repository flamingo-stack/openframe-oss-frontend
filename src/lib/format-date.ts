import { EMPTY_VALUE } from './empty-value';

type DateInput = string | number | Date;

/**
 * The input as a `Date`, or null when it is missing or unparseable — the guard
 * every formatter here applies, exported for the callers that need the `Date`
 * itself (date arithmetic) rather than a string. `0` is a real instant, not a
 * missing one.
 */
export function toValidDate(input: DateInput | null | undefined): Date | null {
  if (input == null || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

// A missing or unparseable input renders as `EMPTY_VALUE`. `Intl.DateTimeFormat.format`
// throws `RangeError: Invalid time value` on an invalid Date, so every formatter
// here guards first — callers can pass raw API values without a per-call check.

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' });
const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
const timeWithSecondsFmt = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

const format = (input: DateInput | null | undefined, fmt: Intl.DateTimeFormat): string => {
  const date = toValidDate(input);
  return date ? fmt.format(date) : EMPTY_VALUE;
};

export const formatDate = (input: DateInput | null | undefined): string => format(input, dateFmt);

export const formatTime = (input: DateInput | null | undefined): string => format(input, timeFmt);

export const formatTimeWithSeconds = (input: DateInput | null | undefined): string => format(input, timeWithSecondsFmt);

export const formatDateTime = (input: DateInput | null | undefined): string => {
  const date = toValidDate(input);
  return date ? `${dateFmt.format(date)} ${timeFmt.format(date)}` : EMPTY_VALUE;
};
