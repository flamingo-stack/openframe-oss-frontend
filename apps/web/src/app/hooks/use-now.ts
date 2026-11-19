'use client';

import { useEffect, useState } from 'react';

/**
 * Current timestamp, re-sampled every `intervalMs`. For time-since labels that
 * must keep ticking between data refetches (e.g. board staleness indicators,
 * where the 15s poll alone would freeze a "No activity for N hours" label at
 * its last fetch).
 *
 * `ticking: false` stops the clock (the value stays at its last sample) for a
 * screen that only needs it while something is pending, so it does not
 * re-render for nothing; ticking again resumes on the next interval.
 */
export function useNow(intervalMs: number, ticking = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, ticking]);
  return now;
}
