/**
 * Whether the tenant gateway is still willing to talk to this session.
 *
 * The gateway runs one path-independent JWT check, so a client that keeps
 * re-sending a rejected token is refused on every path it touches — and before
 * this module nothing remembered the refusal: every poller re-sent it on its own
 * interval, and a deleted tenant (410 on every path) was polled forever.
 *
 *   - `healthy` — nothing known against the session.
 *   - `paused`  — auth could not be re-established. Background polling stops;
 *     user-driven requests still go out. Why it paused decides what ends it:
 *       - `transient`: the refresh itself failed (dropped link, auth-server 5xx).
 *         The tokens may be fine, so any gateway 2xx — the link coming back — ends it.
 *       - `rejected`: a 401 survived a successful refresh, i.e. the gateway refused
 *         the token it had just issued. Other paths keep answering 2xx while this
 *         one is refused (images, `/api/me`), so a stray 2xx proves nothing and
 *         would flap the pause, costing a refresh-token rotation per flap. It ends
 *         only on a token rotation or a successful re-validation probe.
 *   - `gone`    — a 410: the tenant was deleted. Terminal until sign-out; every
 *     gateway request is answered locally from then on (`SessionGoneError`).
 *
 * Fed from the same places that feed `noteUpgradeRequired` — and only from
 * tenant-gateway responses: a 410 from a hub lookup means "not configured", and a
 * 401 from the auth host says nothing about this session.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getTokenEpoch, subscribeToTokenChange } from './token-store';

/** HTTP 410 Gone — the shared gateway's answer, on every path, for a deleted tenant. */
export const SESSION_GONE_STATUS = 410;

export const SESSION_GONE_MESSAGE = 'This workspace has been deleted.';

export type SessionHealth = 'healthy' | 'paused' | 'gone';

export type PauseReason = 'transient' | 'rejected';

interface SessionHealthState {
  health: SessionHealth;
  pauseReason: PauseReason | null;
  /** The token epoch the pause was recorded at: a later epoch is a rotation the pause predates. */
  pausedAtEpoch: number;
}

export const useSessionHealthStore = create<SessionHealthState>()(
  devtools(() => ({ health: 'healthy' as SessionHealth, pauseReason: null as PauseReason | null, pausedAtEpoch: 0 }), {
    name: 'session-health-store',
  }),
);

/** A request answered locally because the tenant is gone. Never retried: it cannot succeed. */
export class SessionGoneError extends Error {
  constructor() {
    super(SESSION_GONE_MESSAGE);
    this.name = 'SessionGoneError';
  }
}

export function getSessionHealth(): SessionHealth {
  return useSessionHealthStore.getState().health;
}

export function isSessionGone(): boolean {
  return getSessionHealth() === 'gone';
}

/** Auth could not be re-established. Never overrides `gone`; `rejected` upgrades a `transient` pause. */
export function markSessionPaused(reason: PauseReason): void {
  const { health, pauseReason } = useSessionHealthStore.getState();
  if (health === 'gone' || (health === 'paused' && (reason === 'transient' || pauseReason === 'rejected'))) return;
  useSessionHealthStore.setState(
    { health: 'paused', pauseReason: reason, pausedAtEpoch: getTokenEpoch() },
    false,
    'markPaused',
  );
}

/** Back to `healthy` from `paused`. A `gone` tenant does not come back by itself. */
export function markSessionHealthy(): void {
  if (getSessionHealth() !== 'paused') return;
  useSessionHealthStore.setState({ health: 'healthy', pauseReason: null }, false, 'markHealthy');
}

function markSessionGone(): void {
  if (isSessionGone()) return;
  useSessionHealthStore.setState({ health: 'gone' }, false, 'markGone');
}

/** Sign-out or a tenant change: the only exits from `gone`. */
export function resetSessionHealth(): void {
  useSessionHealthStore.setState({ health: 'healthy', pauseReason: null, pausedAtEpoch: 0 }, false, 'reset');
}

/**
 * The gateway's deleted-tenant answer is an HTML error page. Tenant services
 * answer 410 too (a recording that is gone), but with JSON — that one is the
 * caller's to handle and says nothing about the tenant.
 */
function isDeletedTenantResponse(response: Pick<Response, 'status' | 'headers'>): boolean {
  return response.status === SESSION_GONE_STATUS && !!response.headers.get('content-type')?.includes('text/html');
}

/**
 * Record what a TENANT-GATEWAY response says about the session; true when it is
 * the deleted-tenant 410. A 2xx ends a `transient` pause only — a `rejected` one is
 * ended by a token rotation or a successful probe (`markSessionHealthy`). Everything else (including a 401, which the caller
 * resolves through refresh first) is not this function's to judge.
 */
export function noteGatewayResponse(response: Pick<Response, 'ok' | 'status' | 'headers'>): boolean {
  if (isDeletedTenantResponse(response)) {
    markSessionGone();
    return true;
  }
  if (response.ok && useSessionHealthStore.getState().pauseReason === 'transient') markSessionHealthy();
  return false;
}

/**
 * A new credential is the answer to "could auth be re-established". Compared on
 * the epoch because cookie mode rotates without announcing it, and because a
 * pause recorded right after a refresh already carries that refresh's epoch.
 */
export function clearPauseIfTokenRotated(): void {
  const { health, pausedAtEpoch } = useSessionHealthStore.getState();
  if (health === 'paused' && getTokenEpoch() !== pausedAtEpoch) markSessionHealthy();
}

subscribeToTokenChange(clearPauseIfTokenRotated);
