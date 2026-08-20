/**
 * Comma-separated URL param helpers for multi-value filters.
 *
 * `useApiParams` serializes `type: 'array'` fields as repeated params
 * (`?assigneeIds=a&assigneeIds=b`). The gateway rejects page URLs with a
 * duplicated query key (502 on the RSC/navigation GET), and the platform
 * convention for multi-value params is a single comma-separated value.
 * Pages therefore keep such filters as `type: 'string'` in the URL schema
 * and convert at the boundary with these helpers.
 *
 * Only for values that can never contain a comma (ids, enum names).
 */

export function toCsvParam(values: string[]): string {
  return values.filter(Boolean).join(',');
}

export function fromCsvParam(value: string): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}
