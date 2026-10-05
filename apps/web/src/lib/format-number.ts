import { EMPTY_VALUE } from './empty-value';

// The viewer's locale, as `format-date` does for dates: "1,234" / "1 234".
const countFmt = new Intl.NumberFormat(undefined);

/** A count — devices, CVEs, requests — grouped in the viewer's locale; {@link EMPTY_VALUE} when missing. */
export function formatCount(value: number | null | undefined): string {
  return value == null ? EMPTY_VALUE : countFmt.format(value);
}

const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** A headline count, compacted in the viewer's locale: 3200000 → "3.2M". */
export function formatCompactCount(value: number): string {
  return compactFmt.format(value);
}
