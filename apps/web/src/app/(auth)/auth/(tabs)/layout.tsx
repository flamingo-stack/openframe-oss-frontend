'use client';

import { AuthShell, CompactAuthShell } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DesktopSignInWaiting } from '@/app/(auth)/auth/components/desktop-sign-in-waiting';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useDesktopSignInWait } from '@/app/hooks/use-desktop-sign-in-wait';
import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';
import { getLandingPath, isAuthOnlyMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';

const TABS = [
  { id: 'signup', label: 'Sign Up' },
  { id: 'login', label: 'Login' },
];

/**
 * Shell for the two auth tabs, and the reason switching between them is cheap.
 *
 * Sign Up and Login are separate routes, and each used to render its own `AuthShell`. Switching
 * therefore tore down the whole shell — branding, benefits panel, tab selector — and rebuilt it,
 * which is what put a skeleton on screen every time. Owning the shell here keeps all of that
 * mounted across the switch: only the card content is a route segment, so only the card can
 * suspend, and the tab selector never goes away because it is not part of what is loading.
 *
 * A login-only mobile build has no Sign Up to switch to: both paths render the login card in the
 * compact shell, with no tabs and no benefits panel.
 *
 * Scoped to a route group so it wraps ONLY these two paths — `invite`, `sso-continue`,
 * `password-reset` and friends sit outside it and bring their own shell.
 */
export default function AuthTabsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const loginOnly = useLoginOnlyMobileShell();
  const wait = useDesktopSignInWait();

  const active = pathname?.startsWith(routes.auth.login) ? 'login' : 'signup';

  useEffect(() => {
    if (isAuthenticated && !isAuthOnlyMode()) {
      // replace, not push: an authenticated user landing here (e.g. via back) is redirected
      // without leaving an auth route in the back stack — no flash, no back-loop.
      router.replace(getLandingPath());
    }
  }, [isAuthenticated, router]);

  // Warm the other tab's segment so the first switch has nothing to fetch. Both are prefetched
  // because either one can be the entry point.
  useEffect(() => {
    router.prefetch(routes.auth.root);
    router.prefetch(routes.auth.login);
  }, [router]);

  // While a desktop sign-in waits on the browser the form is hidden, not unmounted, so Cancel brings
  // it back with what was typed.
  const content = (
    <>
      <div className={wait ? 'hidden' : 'contents'}>{children}</div>
      {wait && <DesktopSignInWaiting wait={wait} />}
    </>
  );

  if (loginOnly) {
    return <CompactAuthShell>{content}</CompactAuthShell>;
  }

  const tabs = (
    <TabSelector
      value={active}
      onValueChange={value => {
        if (value === active) return;
        router.replace(value === 'login' ? routes.auth.login : routes.auth.root);
      }}
      variant="primary"
      items={TABS}
    />
  );

  return <AuthShell tabs={tabs}>{content}</AuthShell>;
}
