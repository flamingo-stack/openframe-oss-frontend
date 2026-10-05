import { EMPTY_VALUE } from '@/lib/empty-value';

/**
 * {@link EMPTY_VALUE} as the UI draws it: muted, so a missing value never reads
 * as a value. Sets the colour only — the size comes from where it sits (a table
 * cell, a summary field, a stat).
 */
export function EmptyValue() {
  return <span className="text-ods-text-secondary">{EMPTY_VALUE}</span>;
}
