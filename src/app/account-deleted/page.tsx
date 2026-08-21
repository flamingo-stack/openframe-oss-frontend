'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ACCOUNT_DELETED_PENDING_STORAGE_KEY,
  DELETED_ACCOUNT_ORG_STORAGE_KEY,
} from '@/app/(app)/settings/hooks/use-account-deletion';
import { authSessionQueryKey } from '@/app/(auth)/auth/hooks/use-auth-session';
import { forceLogout } from '@/lib/force-logout';
import { isAppShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';

/**
 * Full-screen terminal page shown right after successful account
 * self-deletion. Lives OUTSIDE the `(app)` and `(auth)` route groups on
 * purpose: the visitor is signed out by the time it renders, so it must not
 * sit behind the app layout's auth gate, and saas-tenant (web) blocks the
 * `/auth` subtree entirely.
 *
 * The deletion flow `replace`s onto this URL, so Back cannot return to the
 * app. That left the page with no way out at all in the native shells, which
 * have no browser chrome: on the phone the only exit was to kill and relaunch
 * the app. Hence the explicit Sign in action. It mirrors the "Sign in
 * required" overlay's shell/web split — `/auth` inside either shell, the
 * shared auth host's login page on the web — with two deliberate differences:
 * it `replace`s where the overlay assigns, because this page is terminal, and
 * it falls back to a relative `/auth/login/` where the overlay no-ops, because
 * there is no retry to fall back on here.
 *
 * Local sign-out happens HERE, on mount, not in the deletion mutation:
 * clearing the auth store/session cache while still on /settings re-rendered
 * the app chrome signed-out ("Sign in required") for the beat before the
 * navigation landed. The mutation revokes the server session, sets the
 * pending flag and navigates; this page then clears tokens, the store and
 * the session query. The flag gate keeps a stray direct visit from signing
 * out a live session.
 *
 * The organization name is handed over via sessionStorage (the session that
 * knew it is gone); read in an effect — not a state initializer — because the
 * page is prerendered (static export) and a server/client copy mismatch would
 * break hydration. A missing value degrades to generic wording.
 */
export default function AccountDeletedPage() {
  const [organizationName, setOrganizationName] = useState('');
  const queryClient = useQueryClient();
  const router = useRouter();
  // The mount sign-out, so the Sign in action can wait it out. Its tail — the
  // auth-store reset and Mingo-context clear, both behind dynamic imports in
  // forceLogout — would otherwise be free to land after the sign-in flow had
  // started repopulating the store, and wipe it.
  const signOutRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    try {
      setOrganizationName(sessionStorage.getItem(DELETED_ACCOUNT_ORG_STORAGE_KEY) || '');
      if (sessionStorage.getItem(ACCOUNT_DELETED_PENDING_STORAGE_KEY)) {
        signOutRef.current = forceLogout({ shouldRedirect: false })
          .then(() => {
            queryClient.setQueryData(authSessionQueryKey, null);
            // Removed only after the cleanup settles, so a reload that lands
            // mid-cleanup re-runs it. forceLogout is idempotent — StrictMode's
            // double mount just clears the same state twice.
            try {
              sessionStorage.removeItem(ACCOUNT_DELETED_PENDING_STORAGE_KEY);
            } catch {
              // Storage gone — nothing left to unset.
            }
          })
          // Terminal, so the chain carries a handler even if the button is
          // never tapped. forceLogout catches its own failures internally —
          // this only covers the few calls outside those catches.
          .catch(() => {});
      }
    } catch {
      // Storage unavailable — keep the generic copy.
    }
  }, [queryClient]);

  const handleSignIn = async () => {
    // Ordering, not error handling (see signOutRef); the chain cannot reject.
    await signOutRef.current;
    if (isAppShell()) {
      router.replace(routes.auth.root);
      return;
    }
    // Empty when no shared host is configured, which degrades to the relative
    // path. Trailing slash because `trailingSlash: true` canonicalizes to it.
    const host = runtimeEnv.authLoginUrl().replace(/\/+$/, '');
    window.location.replace(`${host}${routes.auth.login}/`);
  };

  return (
    // `of-standalone-shell` is what the native safe-area CSS keys off (globals.css):
    // this page renders outside AppLayout and AuthShell, so nothing else applies the
    // insets and the status bar cropped the logo.
    <div className="of-standalone-shell min-h-screen bg-ods-bg flex flex-col items-center justify-between p-[var(--spacing-system-xlf)]">
      {/* Logo */}
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center gap-[var(--spacing-system-mf)] max-w-[600px] text-center">
        <div className="flex flex-col items-center gap-[var(--spacing-system-xsf)]">
          <h1 className="text-h2 text-ods-text-primary">Your account has been deleted</h1>
          <p className="text-h4 text-ods-text-secondary">
            You no longer have access to {organizationName || 'your organization'}. An email with the details has been
            sent to your email.
          </p>
        </div>
        <Button onClick={handleSignIn}>Back to sign in</Button>
      </div>

      {/* Footer */}
      <a
        href="https://flamingo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-mf)] text-ods-text-secondary rounded-md bg-transparent hover:bg-ods-bg-hover transition-colors"
      >
        <span className="text-h6">Powered by</span>
        <FlamingoLogo className="h-5 w-5" fill="currentColor" />
        <span className="text-code font-semibold">Flamingo</span>
      </a>
    </div>
  );
}
