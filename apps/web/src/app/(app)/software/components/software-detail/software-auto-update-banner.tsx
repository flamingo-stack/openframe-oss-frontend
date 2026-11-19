'use client';

import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareAutoUpdateBanner_software$key } from '@/__generated__/softwareAutoUpdateBanner_software.graphql';
import { SoftwareAutoUpdateStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { isManagedTitle } from './software-auto-update-state';

const softwareAutoUpdateBannerFragment = graphql`
  fragment softwareAutoUpdateBanner_software on Software {
    id
    name
    autoUpdate
  }
`;

/**
 * "Auto-Update Disabled" / "Auto-Update Enabled" over the software's card (design 1100:444 / 1562:59149), with
 * Settings: the title's Auto-update settings page, where it is turned on, edited and turned off. Only for a title a
 * package manager manages: the others have nothing to auto-update with.
 */
export function SoftwareAutoUpdateBanner({ software }: { software: softwareAutoUpdateBanner_software$key }) {
  const data = useFragment(softwareAutoUpdateBannerFragment, software);
  if (!isManagedTitle(data.autoUpdate)) return null;

  const enabled = data.autoUpdate === SoftwareAutoUpdateStatus.ON;
  return (
    <div className="flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-md:flex-row content-md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
        <InfoCircleIcon className="size-6 shrink-0 text-ods-text-secondary" />
        <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h3">{enabled ? 'Auto-Update Enabled' : 'Auto-Update Disabled'}</p>
          <p className="text-ods-text-secondary text-h6">
            {enabled
              ? `Installs new versions of ${data.name} automatically on the selected devices.`
              : `${data.name} updates only when you run Update Software. Turn on auto-update to install new versions as they come out.`}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        href={routes.software.autoUpdate(data.id)}
        className="shrink-0 self-start content-md:self-auto"
      >
        Settings
      </Button>
    </div>
  );
}
