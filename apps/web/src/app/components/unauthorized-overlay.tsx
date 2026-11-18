'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAppMode } from '@/lib/app-mode';
import { isAppShell, shellKind } from '@/lib/platform';
import { captureSignInRequiredClick } from '@/lib/posthog/posthog-events';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';

/**
 * How long Sign in stays pending when the page never leaves (a cancelled or blocked navigation),
 * so a failed tap ends on an enabled button instead of a spinner that never stops.
 */
export const SIGN_IN_PENDING_TIMEOUT_MS = 10_000;

/**
 * The auth host's Login tab, or null when the configured host is missing or not an absolute
 * http(s) URL. There is no tenant-relative fallback: this overlay renders only on a SaaS tenant,
 * and a SaaS tenant redirects every `/auth` path back into the app.
 */
export function buildSignInUrl(sharedHost: string): string | null {
  if (!sharedHost) return null;
  try {
    // Land on the Login tab directly — the auth host's root defaults to Sign Up.
    const url = new URL('auth/login/', `${sharedHost.replace(/\/*$/, '')}/`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function UnauthorizedOverlay() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // The ref guards a second tap that lands before the pending render does.
  const pendingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearPending = useCallback(() => {
    pendingRef.current = false;
    clearTimeout(timeoutRef.current);
    setPending(false);
  }, []);

  const startPending = useCallback(() => {
    pendingRef.current = true;
    setPending(true);
    timeoutRef.current = setTimeout(clearPending, SIGN_IN_PENDING_TIMEOUT_MS);
  }, [clearPending]);

  useEffect(() => {
    // Back from the auth host restores this page from the bfcache with its state as it was left.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearPending();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      clearTimeout(timeoutRef.current);
    };
  }, [clearPending]);

  const handleLogin = () => {
    if (pendingRef.current) return;

    if (isAppShell()) {
      // Auth pages are enabled in the native shell — full sign-in flow
      // (email → tenant discovery → provider selection → system-browser OAuth).
      // replace, not push: don't stack the auth screens on top of the app route,
      // so back after login lands on real content, never the login page.
      startPending();
      try {
        router.replace(routes.auth.root);
      } catch (error) {
        console.error('[UnauthorizedOverlay] sign-in navigation failed:', error);
        clearPending();
      }
      return;
    }

    const target = buildSignInUrl(runtimeEnv.authLoginUrl());
    captureSignInRequiredClick({
      app_mode: getAppMode(),
      shell: shellKind(),
      target_url: target,
      fallback: target === null,
    });

    if (!target) {
      console.error('[UnauthorizedOverlay] NEXT_PUBLIC_SHARED_HOST_URL is missing or invalid; sign-in cannot start');
      setUnavailable(true);
      return;
    }

    setUnavailable(false);
    startPending();
    try {
      // The auth host is a different origin, so this is deliberately a full navigation.
      window.location.assign(target);
    } catch (error) {
      console.error('[UnauthorizedOverlay] sign-in navigation failed:', error);
      clearPending();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ods-bg p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-ods-text-primary text-h2">Sign in required</h1>
        <p className="text-ods-text-secondary">You need to sign in to access this page.</p>
        <div className="flex justify-center">
          <Button onClick={handleLogin} loading={pending} disabled={pending}>
            Sign in
          </Button>
        </div>
        {unavailable && (
          <p role="alert" className="text-ods-error">
            Sign-in is unavailable right now. Please contact support.
          </p>
        )}
      </div>
    </div>
  );
}
