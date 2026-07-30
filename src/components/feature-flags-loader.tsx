'use client';

import { useEffect } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useFeatureFlagsQuery } from '@/app/hooks/use-feature-flags-query';
import { isSaasSharedMode } from '@/lib/app-mode';
import { markSessionReady, resetSessionReady } from '@/lib/session-ready';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

interface FeatureFlagsLoaderProps {
  children: React.ReactNode;
}

/**
 * Runs the server feature-flags query into the store. Renders `children`
 * unconditionally — it does NOT gate the app.
 *
 * It used to (as `FeatureFlagsGate`), returning the app-shell placeholder until
 * the session check and the flags query had both answered. That block was a
 * workaround for one thing: flags were read through
 * `useFeatureFlagsStore.getState()`, a one-shot snapshot, so anything rendered
 * before the answer kept the env default forever. Blocking guaranteed no such
 * read could be wrong — at the cost of the whole chrome mounting twice per cold
 * start, and of needing a route→skeleton registry to have something to paint for
 * the duration.
 *
 * Nothing needs blocking anymore because "not answered yet" became a state the
 * consumers render, instead of a state the app hides. Anything whose wrong value
 * would be visible or would redirect uses `useFeatureFlagGate` and renders a
 * loading branch for its own chrome; the page's own data-loading state covers the
 * rest. That keeps the blocking local to what actually depends on a flag, rather
 * than stopping the whole app and needing a route→skeleton registry to have
 * something to paint.
 *
 * The `enabled` gate on the query is unchanged: no flags are fetched until the
 * session says there is a user to fetch them for.
 */
export function FeatureFlagsLoader({ children }: FeatureFlagsLoaderProps) {
  const saasShared = isSaasSharedMode();
  const { isReady, isAuthenticated } = useAuthSession();
  const isLoaded = useFeatureFlagsStore(s => s.isLoaded);
  const setLoaded = useFeatureFlagsStore(s => s.setLoaded);

  useFeatureFlagsQuery({ enabled: !saasShared && isReady && isAuthenticated });

  // Open the session latch every app data request waits on (see
  // `session-ready.ts`), and close it again on sign-out so a signed-out render
  // can't keep issuing requests with a dead credential.
  useEffect(() => {
    if (isReady && isAuthenticated) {
      markSessionReady();
    } else if (isReady && !isAuthenticated) {
      resetSessionReady();
    }
  }, [isReady, isAuthenticated]);

  // saas-shared never fetches flags (auth-only surface) — mark them terminally
  // loaded so isLoaded consumers don't wait forever. Signed-out sessions are
  // deliberately NOT marked: a loaded-with-empty-flags marker set while signed
  // out would survive into the post-login render, and every `useFeatureFlag`
  // would report the env default as authoritative instead of "not answered yet".
  useEffect(() => {
    if (saasShared && !isLoaded) {
      setLoaded();
    }
  }, [saasShared, isLoaded, setLoaded]);

  return <>{children}</>;
}
