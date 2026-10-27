/**
 * Whether the tenant gateway is still willing to talk to this session.
 *
 * Before this module nothing remembered a refusal: every poller re-sent a refused
 * request on its own interval, and a deleted tenant (410 on every path) was
 * polled forever.
 *
 *   - `healthy` — nothing known against the session.
 *   - `paused`  — auth could not be re-established. Background polling stops;
 *     user-driven requests still go out. Why it paused decides what ends it:
 *       - `transient`: the refresh itself failed (dropped link, auth-server 5xx).
 *         The tokens may be fine, so any gateway 2xx — the link coming back — or a
 *         later rotation ends it.
 *       - `rejected`: a 401 survived a successful refresh. The gateway's JWT check
 *         is the same on every path, so a path refusing a just-issued token while
 *         others answer 2xx is refused behind the gateway; a stray 2xx proves
 *         nothing. Nor does a rotation: the next 401 rotates, and if that ended the
 *         pause, the polls it restarts would 401 and rotate again, indefinitely.
 *         Only a successful re-validation probe ends it.
 *   - `gone`    — a 410 page: the tenant was deleted. Terminal until sign-out;
 *     every gateway request is answered locally from then on (`SessionGoneError`).
 *
 * Fed from the same places that feed `noteUpgradeRequired` — and only from
 * tenant-gateway responses: a 410 from a hub lookup means "not configured", and a
 * 401 from the auth host says nothing about this session.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getTokenEpoch, hasTokensSync, isBearerAuthMode, subscribeToTokenChange } from './token-store';

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

const INITIAL_STATE: SessionHealthState = { health: 'healthy', pauseReason: null, pausedAtEpoch: 0 };

export const useSessionHealthStore = create<SessionHealthState>()(
  devtools(() => INITIAL_STATE, { name: 'session-health-store' }),
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

export function isPausedFor(reason: PauseReason): boolean {
  const { health, pauseReason } = useSessionHealthStore.getState();
  return health === 'paused' && pauseReason === reason;
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

/** The session ended (sign-out, a tenant change): what was known was about it. The only exit from `gone`. */
export function resetSessionHealth(): void {
  useSessionHealthStore.setState(INITIAL_STATE, false, 'reset');
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
 * the deleted-tenant 410. A 2xx ends a `transient` pause only. Everything else
 * (including a 401, which the caller resolves through refresh first) is not
 * this function's to judge.
 */
export function noteGatewayResponse(response: Pick<Response, 'ok' | 'status' | 'headers'>): boolean {
  if (isDeletedTenantResponse(response)) {
    markSessionGone();
    return true;
  }
  if (response.ok && isPausedFor('transient')) markSessionHealthy();
  return false;
}

/**
 * A new credential answers a `transient` pause: the refresh that failed has run
 * since. Compared on the epoch because cookie mode rotates without announcing it.
 * Never a `rejected` one — see the header.
 */
export function clearPauseIfTokenRotated(): void {
  if (isPausedFor('transient') && getTokenEpoch() !== useSessionHealthStore.getState().pausedAtEpoch) {
    markSessionHealthy();
  }
}

// In bearer mode a cleared store is a sign-out, and the shells sign out without
// reloading: without a reset, a pause or `gone` would carry into the next
// sign-in. The reset waits for the tokens to come back: the store is cleared at
// the START of a sign-out, while the app still looks signed in, and lifting
// `gone` there remounts it into the 410s that put the screen back over /auth.
// Not "no tokens before, tokens now": native hydration fills the store without
// emitting, so the first rotation after a cold start would read as a sign-in.
// A cookie-mode sign-in comes back through the auth host, which reloads.
let signedOut = false;
subscribeToTokenChange(() => {
  if (isBearerAuthMode() && !hasTokensSync()) {
    signedOut = true;
  } else if (signedOut) {
    signedOut = false;
    resetSessionHealth();
  } else {
    clearPauseIfTokenRotated();
  }
});
