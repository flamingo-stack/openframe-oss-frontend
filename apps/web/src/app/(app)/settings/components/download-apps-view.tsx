'use client';

import { DownloadAppsPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages';
import { EP } from '@/app/(app)/help-center/endpoints';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { routes } from '@/lib/routes';

/**
 * Settings → Get OpenFrame Apps: a mount of the lib's ready-made `<DownloadAppsPage>`,
 * the same page the website serves at `/download`. It self-fetches the desktop
 * installers and install commands from the hub through the `/content` proxy, and
 * draws the mobile app's store badges and install QR code from the lib's constants.
 * `shell={false}` because `AppLayout` already provides the page `<main>`.
 *
 * What stays this app's decision:
 *
 * - `showDesktop`: inside the desktop app the whole desktop section is an offer of
 *   the app you are already running, and the request for it is not made at all. The
 *   HOOK, not the bare predicate, because it gates a rendered subtree.
 * - `openStoresInNewTab`: a narrow browser window navigates in place (the viewport
 *   term of `useSameWindowLinks`), but the store links must always open OUT of the
 *   desktop shell. It routes `target="_blank"` to the system browser, while a
 *   same-window off-origin navigation would strand the app window on apps.apple.com
 *   with no chrome to come back from.
 */
export function DownloadAppsView() {
  const sameWindow = useSameWindowLinks();
  const desktopShell = useIsDesktopShell();
  return (
    <DownloadAppsPage
      shell={false}
      endpoint={EP.downloads}
      title="Get OpenFrame Apps"
      subtitle="One account, every screen. Install OpenFrame where you work."
      backButton={{ label: 'Back', href: routes.settings.root() }}
      showDesktop={!desktopShell}
      openStoresInNewTab={desktopShell || !sameWindow}
    />
  );
}
