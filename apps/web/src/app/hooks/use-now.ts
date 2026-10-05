'use client';

import { useEffect, useState } from 'react';

/**
 * Current timestamp, re-sampled every `intervalMs`. For time-since labels that
 * must keep ticking between data refetches (e.g. board staleness indicators,
 * where the 15s poll alone would freeze a "No activity for N hours" label at
 * its last fetch).
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
