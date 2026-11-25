'use client';

import { graphql, useFragment } from 'react-relay';
import type { softwareAutoUpdateBanner_software$key } from '@/__generated__/softwareAutoUpdateBanner_software.graphql';
import { SoftwareAutoUpdateStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { SoftwareNoticeBanner } from '../shared/software-notice-banner';
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
    <SoftwareNoticeBanner
      title={enabled ? 'Auto-Update Enabled' : 'Auto-Update Disabled'}
      description={
        enabled
          ? `Installs new versions of ${data.name} automatically on the selected devices.`
          : `${data.name} updates only when you run Update Software. Turn on auto-update to install new versions as they come out.`
      }
      actionLabel="Settings"
      actionHref={routes.software.autoUpdate(data.id)}
    />
  );
}
