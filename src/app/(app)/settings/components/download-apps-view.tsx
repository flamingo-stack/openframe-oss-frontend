'use client';

import { AppleLogoIcon, WindowsLogoGreyIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, DropdownButton, PageLayout, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { loadErrorProps, queryState } from '@/lib/query-state';
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
        <p className="text-h3 text-ods-text-primary">{title}</p>
        <p className="text-h4 text-ods-text-secondary">{description}</p>
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
  // Only the hook's VIEWPORT term is live here — the page 404s in the app shells, so
  // it is narrow browser windows that get a same-window link rather than a new tab
  // they would have to hunt for.
  const sameWindow = useSameWindowLinks();
  const installersQuery = useDesktopInstallers();
  const installers = installersQuery.data;
  // Read through `queryState` rather than the raw flags: an offline query is PAUSED,
  // so `isLoading` and `isError` are both false and the failure would otherwise be
  // invisible. It also keeps the buttons from spinning forever with no link.
  const { isLoading, isOffline, error } = queryState(installersQuery);
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
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] md:grid-cols-2">
        <AppCard title="Desktop App" description="System notifications and auto-start on boot.">
          {degradedMessage && <p className="text-h6 text-ods-warning">{degradedMessage}</p>}
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

        <AppCard title="Mobile App" description="Get alerts and respond to tickets on the go.">
          <div className="flex h-[120px] items-center justify-center rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
            <Tag variant="grey" label="Coming Soon" />
          </div>
        </AppCard>
      </div>
    </PageLayout>
  );
}
