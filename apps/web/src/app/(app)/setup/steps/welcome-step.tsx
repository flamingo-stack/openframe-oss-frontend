'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { AppleLogoIcon, Globe01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, DropdownButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DESKTOP_RELEASES_URL, useDesktopInstallers } from '@/app/(app)/settings/hooks/use-desktop-installers';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { isDesktopShell } from '@/lib/platform';
import { SetupHeading } from '../components/setup-heading';

/**
 * The wizard's first screen. On the web it offers the walk here or the desktop
 * app; inside the desktop app there is nothing to download, so it is one
 * "Continue".
 */
export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  // The hook for what renders, the bare predicate for what is requested - see
  // the Download Apps view for the hydration trade behind the split.
  const desktopShell = useIsDesktopShell();
  const { installers, isLoading } = useDesktopInstallers(!isDesktopShell());
  const sameWindow = useSameWindowLinks();

  const downloads = [
    { id: 'macos', label: 'Download for macOS', url: installers?.macos },
    { id: 'windows-x64', label: 'Download for Windows (x64)', url: installers?.windowsX64 },
    { id: 'windows-arm64', label: 'Download for Windows (ARM)', url: installers?.windowsArm64 },
  ].map(({ id, label, url }) => ({ id, label, href: url ?? DESKTOP_RELEASES_URL, openInNewTab: !sameWindow }));

  return (
    <>
      <SetupHeading
        title="Agentic AI that runs your IT"
        subtitle={
          <>
            Install your first device with a single command.
            <br />
            Then just ask <AgentMark agent="mingo" className="inline-block size-6 align-bottom" />{' '}
            <span className="text-ods-flamingo-cyan">Mingo</span> anything about the machine and it runs the work.
          </>
        }
      />
      {desktopShell ? (
        <Button variant="outline" onClick={onContinue} className="w-full md:w-auto md:min-w-[216px]">
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
