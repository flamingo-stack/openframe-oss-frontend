/**
 * Signup-funnel analytics for the paid-ads journey (landing → auth → signup →
 * dashboard).
 *
 * PostHog is loaded via GTM on every surface — there is NO bundled `posthog-js`
 * in this app. Funnel events go to the GTM `dataLayer`; GTM routes them to
 * PostHog / GA / ads / HubSpot. The cross-domain session handoff reads the
 * GTM-loaded `window.posthog` instance directly (same as the marketing hub).
 *
 * GTM must have triggers mapping these dataLayer events to PostHog tags:
 * `signup_started`, `signup_completed`, `identify`.
 */

/** dataLayer event names for the signup funnel. */
export const FUNNEL_EVENTS = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  IDENTIFY: 'identify',
} as const;

/** Fire-and-forget dataLayer push. Never throws into the auth flow. */
function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(payload);
  } catch {
    // Analytics is best-effort — never break signup.
  }
}

/** Signup form rendered / first interaction. */
export function pushSignupStarted(): void {
  pushDataLayer({ event: FUNNEL_EVENTS.SIGNUP_STARTED });
}

/**
 * Signup succeeded. `userId` is the OpenFrame `user.id` (from `/me`) — the id
 * the backend keys HubSpot on — so PostHog and CRM line up.
 */
export function pushSignupCompleted(userId: string, email?: string): void {
  pushDataLayer({ event: FUNNEL_EVENTS.SIGNUP_COMPLETED, user_id: userId, ...(email ? { email } : {}) });
}

/** Tie the anonymous session to the identified user (GTM → posthog.identify). */
export function pushIdentify(userId: string, email?: string): void {
  pushDataLayer({ event: FUNNEL_EVENTS.IDENTIFY, user_id: userId, ...(email ? { email } : {}) });
}

const PENDING_SIGNUP_KEY = 'posthog:pending_signup';

/**
 * Mark that the server just confirmed a registration, so `signup_completed`
 * fires once — when the authenticated session (carrying the user id) resolves.
 * Registration has no synchronous point where BOTH "server confirmed" and the
 * OpenFrame `user.id` are available (email flow goes register → login →
 * dashboard; SSO leaves the page for OAuth), so we defer the event to the first
 * identified session and gate it on this marker to avoid firing on plain logins.
 * Set it on EVERY signup path: email + Google/Microsoft SSO.
 */
export function markPendingSignup(): void {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_KEY, '1');
  } catch {
    // Best-effort — no marker just means the event doesn't fire.
  }
}

/** Read-and-clear the pending-signup marker. Returns true at most once per signup. */
export function consumePendingSignup(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_SIGNUP_KEY) === '1') {
      sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Append the live PostHog `distinct_id` + `session_id` (read from the GTM-loaded
 * `window.posthog`) to a cross-domain URL as a `#…` hash handoff, so the SaaS
 * auth-host → tenant-dashboard-host redirect continues the SAME session
 * recording instead of starting a new one. No-op when PostHog isn't loaded. Uses
 * the hash fragment (not query) to keep the ids off the server and out of logs.
 * See posthog.com/tutorials/cross-domain-tracking.
 */
export function appendPosthogHandoff(url: string): string {
  try {
    const ph = (typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).posthog : undefined) as
      Record<string, unknown> | undefined;
    const getDistinctId = ph?.get_distinct_id;
    const getSessionId = ph?.get_session_id;
    const distinctId = typeof getDistinctId === 'function' ? (getDistinctId as () => string)() : undefined;
    const sessionId = typeof getSessionId === 'function' ? (getSessionId as () => string)() : undefined;
    if (!distinctId && !sessionId) return url;

    const base = typeof window !== 'undefined' ? window.location.origin : undefined;
    const parsed = new URL(url, base);
    const params = new URLSearchParams();
    if (distinctId) params.set('distinct_id', distinctId);
    if (sessionId) params.set('session_id', sessionId);
    parsed.hash = params.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}
