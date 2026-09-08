/**
 * Fleet writes `0001-01-01T00:00:00Z` for never-set timestamps — treat that
 * sentinel, a missing value, and an unparsable value identically as "not set".
 */
export function fleetTimestampMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) || t <= 0 ? null : t;
}
