'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { consumePendingSignup, pushIdentify, pushSignupCompleted } from '@/lib/posthog/posthog-events';

/**
 * Bridges auth state to the GTM `dataLayer` for the signup funnel. PostHog runs
 * via GTM (no bundled SDK), so this pushes `identify` — and, for a
 * just-registered user, `signup_completed` — the moment an authenticated
 * session first resolves. One central place covering post-signup login, SSO and
 * session restore. The push happens synchronously on the auth-store update,
 * before any dashboard-redirect effect runs, so soft navigations keep the
 * event. Renders nothing.
 */
export function PostHogAnalyticsBridge() {
  useEffect(() => {
    let lastId: string | undefined;

    const sync = (user: { id?: string; email?: string } | null | undefined) => {
      const id = user?.id;
      if (id && id !== lastId) {
        lastId = id;
        pushIdentify(id, user?.email);
        // Funnel event: the just-registered user's session resolved (the marker
        // was set on the signup path). Fires once — never on a plain login.
        if (consumePendingSignup()) {
          pushSignupCompleted(id, user?.email);
        }
      } else if (!id && lastId) {
        lastId = undefined;
      }
    };

    sync(useAuthStore.getState().user);
    return useAuthStore.subscribe(state => sync(state.user));
  }, []);

  return null;
}
