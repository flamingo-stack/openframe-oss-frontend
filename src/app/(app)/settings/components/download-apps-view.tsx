'use client';

import { AppleLogoIcon, WindowsLogoGreyIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  DropdownButton,
  PageLayout,
  StoreBadgeLinks,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { MobileAppQr } from '@/components/mobile-app-qr';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '@/lib/mobile-app-links';
import { isDesktopShell } from '@/lib/platform';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { DESKTOP_RELEASES_URL, useDesktopInstallers } from '../hooks/use-desktop-installers';

interface AppCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

function AppCard({ title, description, children }: AppCardProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="flex flex-col">
        <p className="text-ods-text-primary text-h3">{title}</p>
        <p className="text-ods-text-secondary text-h4">{description}</p>
      </div>
      {children}
    </div>
  );
}

interface DownloadAppsViewProps {
  /**
   * The `download-apps` flag has not answered yet, so it is not yet known whether
   * this page exists for the tenant. Held in the same state as an unresolved
   * installer lookup: the page draws, but nothing is downloadable until the answer
   * lands — otherwise a click inside that window fetches an installer for a tenant
   * the page is about to 404 for.
   */
  pending?: boolean;
}

export function DownloadAppsView({ pending = false }: DownloadAppsViewProps) {
  const handleBack = useSafeBack(routes.settings.root());
  // The page 404s on the phone, so the shell term is only ever true here for the
  // desktop app; otherwise this is the VIEWPORT term, giving narrow browser windows
  // a same-window link rather than a new tab they would have to hunt for.
  const sameWindow = useSameWindowLinks();
  // Inside the desktop app the whole Desktop App card is an offer of the app you are
  // already running — the reason this page used to 404 in every shell.
  //
  // The HOOK, not the bare predicate, because this gates a rendered subtree — see its
  // docstring for the hydration trade.
  const desktopShell = useIsDesktopShell();
  // …but the store links must still open OUT of it. The shell routes `target="_blank"`
  // to the system browser (`handle_new_window`), while a same-window off-origin
  // navigation is unguarded — it would strand the app window on apps.apple.com with
  // no chrome to come back from. So they ignore `sameWindow` here.
  const storeLinksInNewTab = desktopShell || !sameWindow;
  // The BARE predicate here, not `desktopShell`: this gates a request. The hook answers
  // `false` for the hydration render, and react-query's subscribe effect fires before the
  // store re-render corrects it, so the hook would still cost one GitHub call on a cold
  // load of this route in the desktop shell (a soft navigation there is already correct on
  // its first render).
  //
  // It does reach markup second-hand, through `isLoading` into `downloadsPending` and the
  // buttons' `loading` prop — but `pending` is true for every cold load (the feature flag
  // is never cached), which masks the difference. Cache those flags and this becomes a
  // hydration mismatch.
  const { installers, isLoading, isOffline, error } = useDesktopInstallers(!isDesktopShell());
  const downloadsPending = pending || isLoading;

  // Stated inline rather than toasted: the degradation lasts as long as the lookup
  // keeps failing, and it is not cosmetic — every control keeps its "Download for …"
  // label while all three point at the releases listing, so the two Windows entries
  // become the same link under different names. A notice beside them corrects itself
  // when a refetch succeeds, which a fire-once toast cannot.
  const degradedMessage =
    isOffline || error
      ? loadErrorProps(isOffline, "Couldn't reach GitHub — these open the releases page instead.").message
      : null;

  // Windows has no universal installer and the browser can't read the client's CPU
  // architecture, so the whole control opens this menu instead of guessing — which is
  // also why x64 is listed here rather than left as an unlabelled default action.
  const windowsItems = [
    { id: 'x64', label: 'Download for Windows (x64)', url: installers?.windowsX64 },
    { id: 'arm64', label: 'Download for Windows (ARM)', url: installers?.windowsArm64 },
  ].map(({ id, label, url }) => ({
    id,
    label,
    href: url ?? DESKTOP_RELEASES_URL,
    openInNewTab: !sameWindow,
  }));

  return (
    <PageLayout
      title="Get OpenFrame Apps"
      subtitle="One account, every screen. Install OpenFrame where you work."
      backButton={{ label: 'Back', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {/* Grid stays two-column with one card: the Mobile App card keeps the width and
          proportions it has on the web rather than stretching its QR plate across the
          page. */}
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] md:grid-cols-2">
        {!desktopShell && (
          <AppCard title="Desktop App" description="System notifications and auto-start on boot.">
            {degradedMessage && <p className="text-ods-warning text-h6">{degradedMessage}</p>}
            {/* Both platform logos are `#888888` in the design (the Windows one is even named
              "windows-logo-grey") against the white label — the icons default to
              `currentColor`, which would render them at the label's colour. */}
            <DropdownButton
              label="Download for Windows"
              icon={<WindowsLogoGreyIcon className="text-ods-text-secondary" />}
              loading={downloadsPending}
              fullWidth
              items={windowsItems}
            />
            <Button
              variant="outline"
              fullWidth
              loading={downloadsPending}
              href={installers?.macos ?? DESKTOP_RELEASES_URL}
              openInNewTab={!sameWindow}
              leftIcon={<AppleLogoIcon className="text-ods-text-secondary" />}
            >
              Download for macOS
            </Button>
          </AppCard>
        )}

        <AppCard title="Mobile App" description="Get alerts and respond to tickets on the go.">
          {/* Both listings are published and permanent, so these are plain links with no
              installer lookup to fail — which is why they do not hold on `pending` the way
              the desktop card's buttons do. They can therefore render during the flag's
              unanswered window for a tenant the page may then 404: harmless, since a public
              store listing is not a tenant resource. The desktop card's
              ODS buttons have no counterpart here: Apple and Google each require their
              own badge artwork on anything linking to their store. */}
          <StoreBadgeLinks
            appStoreUrl={APP_STORE_URL}
            googlePlayUrl={GOOGLE_PLAY_URL}
            openInNewTab={storeLinksInNewTab}
          />

          {/* One code for both stores: it encodes a single URL that resolves per platform —
              by a gateway `User-Agent` route once that lands, and by `/mobile`'s own
              client-side branch meanwhile. Scanning it is what this card is for; the badges
              above only help someone already reading this on a phone. */}
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <p className="text-ods-text-secondary text-h6">Or scan to install</p>
            {/* The plate is the whole box rather than a square behind the code: a QR is
                decoded as dark-on-light. No padding either — the code carries its own
                4-module quiet zone inside the viewBox, which at this size draws ~13px of
                white before the first module, so padding on top of it would only shrink
                the code for nothing. */}
            <div className="flex h-[120px] items-center justify-center rounded-md bg-ods-bg-inverted">
              <MobileAppQr />
            </div>
          </div>
        </AppCard>
      </div>
    </PageLayout>
  );
}
