'use client';

/**
 * A second gate every APP Relay request passes through, after the session one:
 * "the subscription has been resolved, and it does not lock this workspace".
 *
 * ## What it fixes
 *
 * When a trial expires, the API answers ordinary queries with
 * `SUBSCRIPTION_TRIAL_EXPIRED` and a null payload. Relay cannot accept that for
 * a non-null field, so it throws — and every one of those throws lands in an
 * error boundary. On a cold load the chrome's queries (notifications, time
 * entries, onboarding progress) leave at the same moment as the subscription
 * query itself, so the app painted a wall of error boundaries a beat BEFORE the
 * lock screen it was supposed to show.
 *
 * Ordering is the whole fix: nothing but the subscription query goes out until
 * that query has answered. If the answer locks the workspace, the rest never go
 * out at all — the lock screen is what the user is about to see, and none of
 * their data belongs to it.
 *
 * ## Why parking, and not failing open, is right when LOCKED
 *
 * The session gate (`session-ready.ts`) must never keep waiting, because
 * "pending" there means *unknown* — and an unknown is something the request
 * itself can resolve. `locked` is the opposite: a resolved answer that the
 * request cannot change. Letting it through does not produce data, it produces
 * the crash this module exists to prevent. So a locked workspace parks its app
 * requests until it is paid for, and `markSubscriptionOpen()` — the payment, the
 * resume, the flag turning off — is what wakes them.
 *
 * `pending` keeps the session gate's discipline in full: it is time-boxed, and a
 * subscription query that never answers releases everyone after
 * `FAIL_OPEN_AFTER_MS` rather than stranding the app on its skeletons.
 *
 * ## What bypasses it
 *
 * - The subscription query itself. Nothing else can open the gate, so gating it
 *   would deadlock the app on the first paint.
 * - Everything the lock screen renders — the plan picker and its prices. A user
 *   who cannot load the paywall cannot leave the lock.
 * - Every mutation. They are deliberate user actions (checkout, resume, cancel,
 *   open the billing portal), and the ones that matter here are exactly the ones
 *   a locked workspace needs. A mutation refused server-side surfaces its own
 *   error, which is the correct outcome for something the user just clicked.
 *
 * Queries opt out with `networkCacheConfig: { metadata: { skipSubscriptionGate: true } }`,
 * the Relay-side counterpart of `apiClient`'s `skipSessionGate`.
 */

/**
 * How long a request may wait for the subscription answer before going out
 * regardless. Same sizing rationale as the session gate: longer than any healthy
 * round trip, shorter than a user's patience.
 */
const FAIL_OPEN_AFTER_MS = 10_000;

type GateState =
  /** The subscription query hasn't answered — hold app requests, but not forever. */
  | 'pending'
  /** Resolved and not locking. Requests go out immediately. */
  | 'open'
  /**
   * Resolved as TRIAL_EXPIRED / CANCELED. App requests are held until the
   * workspace is paid for: they are known to come back empty, and "empty" for a
   * non-null field is a thrown error, not a loading state.
   */
  | 'locked';

let state: GateState = 'pending';
let parked: Promise<void> | undefined;
let release: (() => void) | undefined;
let failOpenTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Set once waiting has timed out, so the gate stays transparent instead of
 * arming a fresh 10-second timer for every subsequent request.
 */
let hasFailedOpen = false;

function clearFailOpenTimer(): void {
  if (failOpenTimer !== undefined) {
    clearTimeout(failOpenTimer);
    failOpenTimer = undefined;
  }
}

/** Clears the shared promise and wakes everyone parked on it. */
function settle(): void {
  const wake = release;
  release = undefined;
  parked = undefined;
  clearFailOpenTimer();
  wake?.();
}

/** Resolved as not locking — or resolved as "billing does not apply here". */
export function markSubscriptionOpen(): void {
  if (state === 'open') return;
  state = 'open';
  settle();
}

/**
 * Resolved as locking. Deliberately does NOT settle: whoever is parked is
 * waiting for exactly the outcome that has not happened.
 *
 * The timer is dropped, though — it was counting down "we still don't know", and
 * now we do. Leaving it armed would fail the gate open into the crash.
 */
export function markSubscriptionLocked(): void {
  if (state === 'locked') return;
  state = 'locked';
  clearFailOpenTimer();
  // A real answer re-engages the gate even if waiting had already timed out.
  // Without this, a subscription query slow enough to trip the fail-open would
  // leave the gate transparent for the rest of the session — and a locked
  // workspace would go straight back to the crash this exists to prevent.
  hasFailedOpen = false;
}

/** Back to square one — sign-out, or a session that resolved as no-user. */
export function resetSubscriptionGate(): void {
  state = 'pending';
  hasFailedOpen = false;
  // Wakes anyone parked: they belong to a session that no longer exists, and
  // their 401 is what drives the redirect to sign-in.
  settle();
}

/**
 * `undefined` once the gate is open, so the hot path costs nothing and does not
 * introduce a microtask. Otherwise a promise that resolves when the subscription
 * does — or, while still `pending`, after `FAIL_OPEN_AFTER_MS`.
 */
export function waitForSubscriptionGate(): Promise<void> | undefined {
  if (state === 'open' || hasFailedOpen) return undefined;

  // Server render: no waiting, ever — same reasoning as the session gate. A
  // pending promise keeps its Suspense boundary open and the stream with it.
  // `fetchRelay` throws before reaching here on the server anyway.
  if (typeof window === 'undefined') return undefined;

  parked ??= new Promise<void>(resolve => {
    release = resolve;
    // Only an unanswered gate is time-boxed. `locked` is an answer.
    if (state === 'pending') {
      failOpenTimer = setTimeout(() => {
        failOpenTimer = undefined;
        // State stays 'pending': the subscription genuinely hasn't answered, so
        // a later mark must still be able to do its job.
        hasFailedOpen = true;
        settle();
      }, FAIL_OPEN_AFTER_MS);
    }
  });
  return parked;
}
