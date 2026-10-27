/**
 * Re-validation of a `paused` session: one `/api/me` probe — on the tab coming
 * back, on the link coming back, and on a slow timer while paused. The probe goes
 * through `apiClient`, so its answer feeds session health like any other request:
 * a 2xx resumes polling (explicitly, since a stray 2xx does not end a rejected
 * pause — this probe is the proof), a 410 is the deleted-tenant screen, a 401 that survives
 * a refresh keeps the pause, and a refresh the server rejects signs the user out.
 */

import { apiClient } from './api-client';
import {
  clearPauseIfTokenRotated,
  getSessionHealth,
  markSessionHealthy,
  useSessionHealthStore,
} from './session-health';

export const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
/** Floor between event-driven probes, so a flapping tab focus cannot turn into a poller. */
export const REVALIDATE_MIN_GAP_MS = 30 * 1000;

export function startSessionRevalidation(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let lastProbeAt = 0;

  const disarm = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const arm = () => {
    disarm();
    timer = setTimeout(() => void probe(0), REVALIDATE_INTERVAL_MS);
  };

  async function probe(minGapMs: number) {
    if (getSessionHealth() !== 'paused' || inFlight || Date.now() - lastProbeAt < minGapMs) return;
    inFlight = true;
    lastProbeAt = Date.now();
    try {
      const response = await apiClient.me();
      if (response.ok) markSessionHealthy();
    } finally {
      inFlight = false;
      if (getSessionHealth() === 'paused') arm();
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') void probe(REVALIDATE_MIN_GAP_MS);
  };
  const onOnline = () => void probe(REVALIDATE_MIN_GAP_MS);

  const unsubscribe = useSessionHealthStore.subscribe(state => {
    if (state.health === 'paused') arm();
    else disarm();
  });
  if (getSessionHealth() === 'paused') {
    clearPauseIfTokenRotated();
    if (getSessionHealth() === 'paused') arm();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  return () => {
    unsubscribe();
    disarm();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
  };
}
