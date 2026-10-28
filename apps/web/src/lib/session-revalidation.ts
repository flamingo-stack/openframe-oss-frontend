/**
 * Re-validation of a `paused` session: one `/api/me` probe — on the app coming
 * back, on the link coming back, and on a slow timer while paused. The probe goes
 * through `apiClient`, so its answer feeds session health like any other request:
 * a 410 is the deleted-tenant screen, a 401 that survives a refresh keeps the
 * pause, and a refresh the server rejects signs the user out. A 2xx resumes
 * polling explicitly, since a stray 2xx does not end a `rejected` pause and this
 * probe is the proof that does.
 *
 * "The app coming back" is `visibilitychange` for the browser plus `onAppResume`
 * for the shells, and "the link" is `subscribeConnectivity`, not the window
 * `online` event: WKWebView flips `visibilityState` unreliably and delivers
 * `online` late (connectivity.ts).
 */

import { apiClient } from './api-client';
import { subscribeConnectivity } from './connectivity';
import { onAppResume } from './native-shell';
import {
  clearPauseIfTokenRotated,
  getSessionHealth,
  isPausedFor,
  markSessionHealthy,
  useSessionHealthStore,
} from './session-health';

export const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
/**
 * Ceiling for the interval while a refusal keeps coming back: a probe that leaves the
 * session `rejected`, or a relapse (see `RELAPSE_WINDOW_MS`), doubles it.
 */
export const REVALIDATE_MAX_INTERVAL_MS = 60 * 60 * 1000;
/** Floor between event-driven probes, so a flapping tab focus cannot turn into a poller. */
export const REVALIDATE_MIN_GAP_MS = 30 * 1000;
/**
 * A `rejected` pause back this soon after a probe resumed polling is the same
 * refusal: the probe asks `/api/me`, and the path that refuses is another one.
 * Each round costs a refresh-token rotation, so the interval doubles instead.
 */
export const RELAPSE_WINDOW_MS = 60 * 1000;

export function startSessionRevalidation(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let stopped = false;
  let lastProbeAt = 0;
  let resumedAt = Number.NEGATIVE_INFINITY;
  let interval = REVALIDATE_INTERVAL_MS;
  let linkUp: boolean | null = null;

  const disarm = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const arm = () => {
    disarm();
    timer = setTimeout(() => void probe(0), interval);
  };

  async function probe(minGapMs: number) {
    if (stopped || getSessionHealth() !== 'paused' || inFlight || Date.now() - lastProbeAt < minGapMs) return;
    inFlight = true;
    lastProbeAt = Date.now();
    try {
      const response = await apiClient.me();
      if (response.ok) {
        resumedAt = Date.now();
        markSessionHealthy();
      }
    } catch (error) {
      // A probe that threw did not resume anything; the re-arm below is the retry.
      console.warn('[Session Revalidation] probe failed:', error);
    } finally {
      inFlight = false;
      // Stopped while the probe was out: re-arming would leave a timer nothing clears.
      if (!stopped && getSessionHealth() === 'paused') {
        // Still refused: the probe's 401 went through a refresh, so each round
        // costs a rotation. With the window hidden nothing else ends the pause.
        if (isPausedFor('rejected')) interval = Math.min(interval * 2, REVALIDATE_MAX_INTERVAL_MS);
        arm();
      }
    }
  }

  // While backed off, the app or the link coming back waits out the interval too.
  const probeSoon = () => void probe(Math.max(REVALIDATE_MIN_GAP_MS, interval - REVALIDATE_INTERVAL_MS));

  const onVisibility = () => {
    if (document.visibilityState === 'visible') probeSoon();
  };

  const unsubscribe = useSessionHealthStore.subscribe((state, previous) => {
    if (state.health !== 'paused') {
      disarm();
      return;
    }
    if (previous.health !== 'paused') {
      const relapse = state.pauseReason === 'rejected' && Date.now() - resumedAt < RELAPSE_WINDOW_MS;
      interval = relapse ? Math.min(interval * 2, REVALIDATE_MAX_INTERVAL_MS) : REVALIDATE_INTERVAL_MS;
    }
    arm();
  });
  if (getSessionHealth() === 'paused') {
    clearPauseIfTokenRotated();
    if (getSessionHealth() === 'paused') arm();
  }

  document.addEventListener('visibilitychange', onVisibility);
  const removeResume = onAppResume(probeSoon, 'Session Revalidation');
  // The listener is called with the current state on subscribe; only an
  // off → on edge is the link coming back.
  const unsubscribeLink = subscribeConnectivity(online => {
    if (online && linkUp === false) probeSoon();
    linkUp = online;
  });
  return () => {
    stopped = true;
    unsubscribe();
    disarm();
    document.removeEventListener('visibilitychange', onVisibility);
    removeResume();
    unsubscribeLink();
  };
}
