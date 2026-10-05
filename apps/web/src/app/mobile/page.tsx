'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { StoreBadgeLinks } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { MobileAppQr } from '@/components/mobile-app-qr';
import {
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  MOBILE_APP_INSTALL_HOST_PATH,
  resolveMobileStoreUrl,
} from '@/lib/mobile-app-links';
import { isAppShell } from '@/lib/platform';

/**
 * What the install QR code resolves to — and, for a phone, the last page before
 * the store.
 *
 * The per-OS split is MEANT to happen one layer up — a `User-Agent` predicate on the
 * shared gateway that 302s a phone to its store before this renders. That route is not
 * in any checked-in gateway config yet, so until it lands the redirect below is the
 * only one there is, and a phone paints this page before it fires.
 *
 * Either way the page has to stand on its own: it serves desktop visitors and crawlers,
 * plus the one case no server-side rule can ever classify — iPadOS Safari, which requests
 * desktop sites by default and sends a `Macintosh` user agent indistinguishable from a
 * real Mac.
 *
 * Lives OUTSIDE `(app)` and `(auth)`, like `/account-deletion`: no session, no app
 * chrome, and the saas-shared host that serves the canonical URL redirects
 * everything but its allowlist to `/auth` (proxy.ts, lib/app-mode.ts).
 */
export default function MobileAppPage() {
  const desktopShell = useIsDesktopShell();

  useEffect(() => {
    // Never from inside a shell: a configured App Link opens the app ON this URL, and
    // redirecting would send the user to the store listing for the app they just opened.
    if (isAppShell()) {
      return;
    }
    const storeUrl = resolveMobileStoreUrl(navigator.userAgent, navigator.maxTouchPoints);
    if (storeUrl) {
      // `replace`, not `assign`: Back from the store should return to whatever sent
      // the visitor here, not to a page that immediately forwards them again.
      window.location.replace(storeUrl);
    }
  }, []);

  return (
    <div className="of-standalone-shell flex min-h-screen flex-col items-center gap-[var(--spacing-system-xlf)] bg-ods-bg p-[var(--spacing-system-xlf)]">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      <main className="flex w-full max-w-[420px] flex-col items-center gap-[var(--spacing-system-lf)]">
        <header className="flex flex-col items-center gap-[var(--spacing-system-xsf)] text-center">
          <h1 className="text-ods-text-primary text-h2">Get the OpenFrame app</h1>
          <p className="text-ods-text-secondary text-h6">
            Alerts and tickets on your phone, signed in with the account you already have.
          </p>
        </header>

        <div className="flex flex-col items-center gap-[var(--spacing-system-sf)]">
          <div className="rounded-md bg-ods-bg-inverted p-[var(--spacing-system-mf)]">
            <MobileAppQr className="h-[180px] w-[180px]" />
          </div>
          <p className="text-ods-text-tertiary text-h6">{MOBILE_APP_INSTALL_HOST_PATH}</p>
        </div>

        {/* Same-window on the web — handing the visitor onward is this page's whole job —
            with the desktop shell excepted for the reason `download-apps-view.tsx` spells
            out. No `!sameWindow` term unlike that card: a narrow window here should still
            navigate rather than spawn a tab. */}
        <StoreBadgeLinks
          appStoreUrl={APP_STORE_URL}
          googlePlayUrl={GOOGLE_PLAY_URL}
          openInNewTab={desktopShell}
          className="justify-center"
        />
      </main>

      <a
        href="https://flamingo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center gap-[var(--spacing-system-xsf)] rounded-md bg-transparent p-[var(--spacing-system-mf)] text-ods-text-secondary transition-colors hover:bg-ods-bg-hover"
      >
        <span className="text-h6">Powered by</span>
        <FlamingoLogo className="h-5 w-5" fill="currentColor" />
        <span className="font-semibold text-code">Flamingo</span>
      </a>
    </div>
  );
}
