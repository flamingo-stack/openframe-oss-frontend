'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { AppleLogoIcon, Globe01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, DropdownButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDownloads } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { AppDownload } from '@flamingo-stack/openframe-frontend-core/types';
import { EP } from '@/app/(app)/help-center/endpoints';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { isDesktopShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { SetupHeading } from '../components/setup-heading';

/** The server's installer for a system and architecture, if it offers one. */
function installerUrl(downloads: readonly AppDownload[], os: AppDownload['os'], architecture?: string): string | null {
  return (
    downloads.find(
      d => d.kind === 'binary' && d.os === os && (architecture === undefined || d.architecture === architecture),
    )?.url ?? null
  );
}

/**
 * The wizard's first screen. On the web it offers the walk here or the desktop
 * app; inside the desktop app there is nothing to download, so it is one
 * "Continue".
 */
export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  // The hook for what renders, the bare predicate for what is requested - see
  // the Download Apps view for the hydration trade behind the split.
  const desktopShell = useIsDesktopShell();
  // The installers come from the server's download list, the one the Download
  // Apps page shows; an installer the list lacks sends the user to that page.
  const { data, isLoading } = useDownloads({ endpoint: EP.downloads, enabled: !isDesktopShell() });
  const sameWindow = useSameWindowLinks();

  const desktop = data?.desktop ?? [];
  const downloads = [
    { id: 'macos', label: 'Download for macOS', url: installerUrl(desktop, 'mac') },
    { id: 'windows-x64', label: 'Download for Windows (x64)', url: installerUrl(desktop, 'windows', 'x64') },
    { id: 'windows-arm64', label: 'Download for Windows (ARM)', url: installerUrl(desktop, 'windows', 'arm64') },
  ].map(({ id, label, url }) => ({
    id,
    label,
    href: url ?? routes.settings.downloadApps,
    openInNewTab: url !== null && !sameWindow,
  }));

  return (
    <>
      <SetupHeading
        title="Agentic AI that runs your IT"
        subtitle={
          <>
            Install your first device with a single command.
            <br />
            Then just ask{' '}
            <AgentMark
              agent="mingo"
              className="inline-block size-6 align-bottom text-ods-flamingo-cyan"
              color="currentColor"
            />{' '}
            <span className="text-ods-flamingo-cyan">Mingo</span> anything about the machine and it runs the work.
          </>
        }
      />
      {desktopShell ? (
        <Button variant="outline" onClick={onContinue} className="w-full sm:w-auto sm:min-w-[204px]">
          Continue
        </Button>
      ) : (
        <div className="flex w-full max-w-[600px] flex-col gap-[var(--spacing-system-lf)] md:flex-row">
          <Button variant="outline" leftIcon={<Globe01Icon />} onClick={onContinue} className="w-full md:flex-1">
            Continue on Web
          </Button>
          <DropdownButton
            variant="outline"
            size="default"
            icon={<AppleLogoIcon className="text-ods-text-secondary" />}
            label="Download for macOS"
            items={downloads}
            loading={isLoading}
            fullWidth
            className="md:flex-1"
          />
        </div>
      )}
    </>
  );
}
