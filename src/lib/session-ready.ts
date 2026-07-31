'use client';

/**
 * A gate every APP data request passes through: "the session has resolved and
 * there is a user to fetch for".
 *
 * Why the network layer and not the component tree: pages must be free to render
 * before `/me` answers — that is what lets each page's OWN loading state be the
 * only skeleton, instead of a central route→skeleton registry painting the gap.
 * But rendering early must not mean fetching early: a query issued before the
 * session resolves either 401s into the refresh/force-logout path, or (during
 * server rendering, where no user cookie exists at all) fires a pointless
 * request from the Node process.
 *
 * Gating here gets both. Query hooks are called normally, their fetch simply
 * does not leave until the session resolves, so Relay suspends and the page shows
 * its own `<Suspense>` fallback. During server rendering the gate never opens,
 * which is the intended behaviour: no app request is made, and the HTML carries
 * the page's own skeleton.
 *
 * The two bootstrap calls that establish the session itself — `/me` and the
 * feature-flags query — must pass `skipSessionGate` or nothing would ever open
 * the gate. `AuthApiClient` is unaffected: it uses raw `fetch`, so sign-in and
 * sign-out never touch this.
 *
 * ## THIS GATE IS AN OPTIMIZATION AND MUST FAIL OPEN
 *
 * It exists to skip requests that are *known* to be pointless, not to enforce
 * anything — a signed-out user is kept out by `RouteGuard` and by the API itself.
 * So every path that stops resolving must end in "let the request go and deal
 * with the answer", never in "keep waiting". Two rules encode that, and both are
 * load-bearing:
 *
 * 1. **A parked request is always woken.** `settle()` is the only way the shared
 *    promise is cleared, and it always calls the resolver. The previous version
 *    dropped it (`openLatch = undefined` without calling it) when the session
 *    resolved as signed-out — which left every request already parked on that
 *    promise waiting on a resolver that no longer existed. Nothing could wake
 *    them: a later `markSessionReady()` found `openLatch` already `undefined`,
 *    while newly issued requests took the fast path and succeeded. That is the
 *    "infinite skeleton with no network activity" bug — unrecoverable except by
 *    reloading, because a promise with no resolver has no timeout and no error.
 *
 * 2. **Waiting is time-boxed.** If the session never resolves at all (a `/me`
 *    that keeps failing, a browser stuck reporting offline), parked requests are
 *    released after `FAIL_OPEN_AFTER_MS` and take their chances. A real 401 then
 *    routes through the refresh/force-logout path that already exists, and a real
 *    network error surfaces in the query as an error the user can retry. Both
 *    beat a skeleton that never resolves.
 */

/**
 * How long a request may wait for the session before going out regardless.
 * Sized as "longer than any healthy `/me` round trip, shorter than a user's
 * patience": under it the gate still does its job on every normal load, over it
 * something is wrong and a real error beats an eternal placeholder.
 */
const FAIL_OPEN_AFTER_MS = 10_000;

type SessionState =
  /** `/me` hasn't answered yet — hold app requests. */
  | 'pending'
  /** Signed in: requests go out immediately. */
  | 'ready'
  /**
   * `/me` answered "no user". Requests are NOT held: the gate only skips
   * requests whose outcome is already known, and here it is — they will 401, and
   * that 401 is what drives `forceLogout` and the redirect to sign-in. Holding
   * them instead would suppress the very signal that recovers the session.
   */
  | 'signed-out';

let state: SessionState = 'pending';
let pending: Promise<void> | undefined;
let release: (() => void) | undefined;
let failOpenTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Set once waiting has timed out. From then on the gate is transparent until the
 * session actually resolves — without it, each request issued after the timeout
 * would arm its own fresh timer and stall for the full duration again, turning
 * one broken session into a permanently 10-s-per-request app.
 */
let hasFailedOpen = false;

/**
 * Clears the shared promise and wakes everyone parked on it.
 *
 * The unconditional `release?.()` is the whole point — see rule 1 above. Any
 * future edit that clears `pending` or `release` without going through here
 * reintroduces the deadlock.
 */
function settle(): void {
  const wake = release;
  release = undefined;
  pending = undefined;
  if (failOpenTimer !== undefined) {
    clearTimeout(failOpenTimer);
    failOpenTimer = undefined;
  }
  wake?.();
}

/** Session resolved as signed in. Idempotent; safe to call from an effect. */
export function markSessionReady(): void {
  if (state === 'ready') return;
  state = 'ready';
  settle();
}

/**
 * Session resolved as signed out — on sign-out, and on a `/me` that answers
 * "no user". Idempotent.
 *
 * Note this does NOT re-hold requests (see `'signed-out'` above). It used to,
 * which is what made a mid-flight sign-out or an expired-token refresh hang the
 * requests that were parked at that moment.
 */
export function resetSessionReady(): void {
  if (state === 'signed-out') return;
  state = 'signed-out';
  settle();
}

/**
 * `undefined` once the session has resolved either way, so the hot path costs
 * nothing and does not introduce a microtask. Otherwise a promise that resolves
 * when it resolves — or when `FAIL_OPEN_AFTER_MS` elapses, whichever comes first.
 */
export function waitForSessionReady(): Promise<void> | undefined {
  if (state !== 'pending' || hasFailedOpen) return undefined;

  // Server render: no waiting, ever.
  //
  // This used to return a promise that never settles, on the theory that React
  // would abandon the render and let the client take over. It does not. A pending
  // promise inside a Suspense boundary keeps that boundary open, and React's
  // stream stays open until every boundary settles — so the HTTP response never
  // completed. The page's HTML was already flushed and interactive, which is why
  // this looked like a working page with a browser tab that spins forever, and it
  // reproduced on every reload of any route with a Relay query (`/scripts-v2` hung
  // indefinitely; `/dashboard`, whose data is react-query and never suspends,
  // closed in ~100ms).
  //
  // Rule 2 above ("waiting is time-boxed") applies here as much as on the client;
  // the server case is just unbounded rather than slow. Callers that must not
  // issue a request during a server render enforce that themselves — see the
  // `typeof window` guard in `fetchRelay`, which throws instead, settling the
  // boundary so the stream closes and React retries the subtree on the client.
  if (typeof window === 'undefined') {
    return undefined;
  }

  pending ??= new Promise<void>(resolve => {
    release = resolve;
    failOpenTimer = setTimeout(() => {
      failOpenTimer = undefined;
      // State stays 'pending': the session genuinely hasn't resolved, so a later
      // mark/reset must still be able to do its job. `hasFailedOpen` is what
      // makes the gate transparent from here on.
      hasFailedOpen = true;
      settle();
    }, FAIL_OPEN_AFTER_MS);
  });
  return pending;
}
