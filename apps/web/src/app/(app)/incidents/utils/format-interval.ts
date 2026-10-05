const UNITS: ReadonlyArray<[label: string, seconds: number]> = [
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/**
 * `Insight.interval` (seconds between runs of the detecting query) as
 * "15 minutes" / "1 hour 30 minutes". Fixed-unit arithmetic on purpose — the
 * interval is a duration, and date-fns' calendar math would make it depend on
 * the month and DST.
 */
export function formatInterval(seconds: number): string {
  if (seconds <= 0) return 'Manual';
  const parts: string[] = [];
  let rest = Math.floor(seconds);
  for (const [label, size] of UNITS) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${count} ${label}${count === 1 ? '' : 's'}`);
      rest -= count * size;
    }
  }
  return parts.join(' ');
}
