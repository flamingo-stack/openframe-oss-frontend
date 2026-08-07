'use client';

import { useEffect } from 'react';
import { useRelayEnvironment } from 'react-relay';
import { refreshOnboardingProgress } from '@/graphql/onboarding/onboarding-progress-relay';
import { useOnboardingStore } from '@/stores/onboarding-store';

/**
 * Keeps the onboarding progress store hydrated for as long as it is mounted.
 * Renders nothing. Mounted in the app shell once the session has resolved, so
 * the onboarding queries never fire while the feature is off. Non-suspending —
 * the fetch runs in an effect and errors degrade gracefully (see
 * `refreshOnboardingProgress`, which marks the store loaded on an error or a
 * null payload so the chrome can never wait on it forever).
 *
 * Driven by `isLoaded` rather than by mount alone. Mount-only hydration made
 * "the store was emptied while I was mounted" unrecoverable: the effect keyed on
 * the Relay environment, which is a singleton, so it never re-ran, and the shell
 * derives `chromeLoading` from `isLoaded` — a reset that arrived after hydration
 * pinned the sidebar and header to their skeleton for the rest of the session.
 * `auth-store.logout()` performs exactly that reset, and `forceLogout` reaches it
 * without unmounting anything whenever a transient `/oauth/refresh` failure turns
 * a single 401 into a sign-out the server-side cookie never actually honored.
 *
 * That specific route is now closed at the source (`force-logout.ts` settles the
 * session query first, which unmounts this component), but reading the store
 * makes ANY future reset self-healing rather than terminal, which is the property
 * worth having: hydration is idempotent, so re-running it costs one query.
 *
 * The effect cannot spin. It re-runs only when `isLoaded` flips, an in-flight
 * fetch leaves it false without re-triggering, and every terminal outcome of
 * `refreshOnboardingProgress` sets it true.
 */
export function OnboardingProgressHydrator() {
  const environment = useRelayEnvironment();
  const isLoaded = useOnboardingStore(state => state.isLoaded);

  useEffect(() => {
    if (isLoaded) return;
    refreshOnboardingProgress(environment);
  }, [environment, isLoaded]);

  return null;
}
