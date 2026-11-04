'use client';

import { Logout01Icon, Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { invalidateAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { performLogout } from '@/app/(auth)/auth/utils/auth-actions';
import { OpenframeLockup } from '@/app/components/shared/openframe-lockup';
import { PoweredByFlamingo } from '@/app/components/shared/powered-by-flamingo';
import { forceLogout } from '@/lib/force-logout';
import { isAppShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { clearPauseIfTokenRotated, resetSessionHealth } from '@/lib/session-health';
import { getRefreshBackoffRemainingMs, type RefreshOutcome, refreshTokens } from '@/lib/token-refresh-manager';

/**
 * Floor for the automatic retry. The backoff marker is what spaces the cycles;
 * where it cannot be read, this keeps the screen from retrying back to back.
 */
const MIN_AUTO_RETRY_MS = 5_000;

/**
 * What a cycle's answer means for this screen. Shared by the Retry button and
 * the automatic retry.
 */
async function settleOutcome(outcome: RefreshOutcome, queryClient: QueryClient): Promise<void> {
  if (outcome === 'refreshed') {
    // Cookie mode rotates without a token-change event, so the pause is lifted
    // here rather than waiting for a gateway 2xx that nothing under this screen
    // sends — and `/me` is re-asked now instead of on its own recheck, which is
    // what brings the app back.
    clearPauseIfTokenRotated();
    invalidateAuthSession(queryClient);
    return;
  }
  if (outcome === 'terminal') {
    // The refresh token is dead: the stored tokens are already cleared by the
    // manager; settle the session as signed out so the sign-in flow takes over.
    await forceLogout({ reason: 'Session unavailable screen - refresh rejected' });
    resetSessionHealth();
  }
}

/** The tail of `performLogout` without the gateway call: for when the gateway cannot revoke. */
async function signOutLocally(): Promise<void> {
  await forceLogout({ shouldRedirect: false });
  resetSessionHealth();
  if (isAppShell()) {
    window.location.replace(routes.root);
    return;
  }
  const sharedHostUrl = runtimeEnv.sharedHostUrl();
  window.location.replace(sharedHostUrl ? `${sharedHostUrl}${routes.auth.login}` : routes.auth.login);
}

/**
 * Replaces the app while the session is `paused` as `transient`
 * (`session-health.ts`): a 401 went through a refresh, and the refresh failed
 * for a reason that says nothing about the credential — the auth server down
 * (502/503 from `/oauth/refresh`), a dropped link, a WAF refusal. Before this
 * screen the page sat in its skeletons with nothing to do but close the tab,
 * while every 401 behind it started another refresh cycle.
 *
 * Replaces the tree the way `WorkspaceGoneGate` does rather than floating over
 * it: a recovery then remounts every page query fresh instead of leaving the
 * ones that failed behind their error boundaries. The route is kept, so a Retry
 * that succeeds lands the user where they were.
 *
 * The cycles are paced by `token-refresh-manager.ts`: this screen schedules one
 * automatic retry per backoff step, and Retry runs one now.
 */
export function SessionUnavailableScreen() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Replaces the whole tree — move focus so assistive tech announces it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // One cycle per backoff step, so a tab left open comes back on its own once
  // the auth service does: `/api/me`'s own recheck only runs while it has no
  // answer at all, and the page's polls are stopped by the pause.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const nextDelay = () => Math.max(getRefreshBackoffRemainingMs(), MIN_AUTO_RETRY_MS);
    const tick = async () => {
      if (cancelled) return;
      const outcome = await refreshTokens();
      if (cancelled) return;
      await settleOutcome(outcome, queryClient);
      if (!cancelled && outcome === 'transient') timer = setTimeout(() => void tick(), nextDelay());
    };
    timer = setTimeout(() => void tick(), nextDelay());
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [queryClient]);

  const retry = async () => {
    setRetrying(true);
    try {
      const outcome = await refreshTokens(undefined, { ignoreBackoff: true });
      await settleOutcome(outcome, queryClient);
      if (outcome === 'transient') {
        toast({
          title: 'Still unavailable',
          description: "The sign-in service hasn't answered yet. Try again in a moment.",
          variant: 'destructive',
        });
      }
    } finally {
      setRetrying(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      // The app's own Log Out: revokes the refresh token at the gateway, then
      // lands on the login tab. The revocation is best-effort inside it.
      await performLogout();
    } catch {
      // The revocation needs the very service that is down: sign out locally
      // and land on the same login tab.
      await signOutLocally();
    }
  };

  return (
    <main className="of-standalone-shell flex min-h-screen flex-col items-center justify-between bg-ods-bg p-[var(--spacing-system-xl)]">
      <OpenframeLockup />

      <div className="flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-xl)]">
        <div className="flex flex-col gap-[var(--spacing-system-xs)] text-center">
          <h1 ref={headingRef} tabIndex={-1} className="text-ods-text-primary text-h2 focus:outline-none">
            We can&apos;t verify your session
          </h1>
          <p className="text-ods-text-secondary text-h4">
            The sign-in service isn&apos;t responding right now. You can try again, or sign out and sign in later.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-[var(--spacing-system-m)]">
          <Button
            variant="accent"
            leftIcon={<Refresh01RightIcon />}
            loading={retrying}
            disabled={signingOut}
            onClick={retry}
          >
            Retry
          </Button>
          <Button
            variant="outline"
            leftIcon={<Logout01Icon />}
            loading={signingOut}
            disabled={retrying}
            onClick={signOut}
          >
            Sign Out
          </Button>
        </div>
      </div>

      <PoweredByFlamingo />
    </main>
  );
}
