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

import { isAppShell, isDesktopShell } from '@/lib/platform';
import { moveToTenantOrigin } from '@/lib/posthog/desktop-tenant-urls';

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

/**
 * Queues the desktop app's `before_send` hook and `app_platform` tag. Call before GTM loads: the GTM
 * PostHog tag's snippet adopts an existing `window.posthog` array as its call queue, and the SDK
 * replays that queue before the first `$pageview`, which calls made after load would miss.
 */
export function queueDesktopPostHogSetup(): void {
  if (!isDesktopShell()) return;
  const w = window as unknown as { posthog?: unknown[] };
  w.posthog = w.posthog || [];
  w.posthog.push(['set_config', { before_send: moveToTenantOrigin }]);
  w.posthog.push(['register', { app_platform: 'desktop' }]);
}

/** PostHog event for a tap on Sign in on the "Sign in required" overlay. */
export const SIGN_IN_REQUIRED_CLICK_EVENT = 'sign_in_required_click';

export interface SignInRequiredClick {
  app_mode: string;
  shell: string;
  /** Where the tap navigates; null when the auth host is not configured. */
  target_url: string | null;
  /** True when there was nowhere to navigate and the overlay showed an error instead. */
  fallback: boolean;
}

/**
 * Record a tap on the "Sign in required" overlay, so a "Sign in does nothing" report can be
 * checked against what the tap did. Captured on the GTM-loaded `window.posthog` directly rather
 * than through the dataLayer: it needs no GTM trigger, and `sendBeacon` lets it survive the
 * cross-origin navigation the same tap starts.
 *
 * Best-effort and silent: a no-op until the SDK has loaded (on desktop `window.posthog` is a
 * plain call queue until GTM runs, see {@link queueDesktopPostHogSetup}), and in the native
 * shells, whose store privacy labels this event is not part of.
 */
export function captureSignInRequiredClick(properties: SignInRequiredClick): void {
  if (typeof window === 'undefined' || isAppShell()) return;
  try {
    const posthog = (window as unknown as { posthog?: { capture?: unknown } }).posthog;
    if (typeof posthog?.capture !== 'function') return;
    (posthog.capture as (event: string, props: object, options: object) => void)(
      SIGN_IN_REQUIRED_CLICK_EVENT,
      properties,
      { transport: 'sendBeacon' },
    );
  } catch {
    // Analytics is best-effort — never break sign-in.
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

/**
 * Tie the anonymous session to the person (GTM → PostHog + HubSpot identify, both keyed on `email`).
 * No `userId` on the auth host: the account does not exist there yet.
 */
export function pushIdentify({ userId, email }: { userId?: string; email?: string }): void {
  pushDataLayer({ event: FUNNEL_EVENTS.IDENTIFY, ...(userId ? { user_id: userId } : {}), ...(email ? { email } : {}) });
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
