'use client';

import { SOFTWARE_ACTION_COPY } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { graphql, useFragment } from 'react-relay';
import type { softwareDetailHeader_software$key } from '@/__generated__/softwareDetailHeader_software.graphql';
import { routes } from '@/lib/routes';
import { DetailTitle } from '../shared/detail-title';
import { isManagedTitle } from './software-auto-update-state';
import { SOFTWARE_DETAIL_TITLE } from './software-detail-title';

const softwareDetailHeaderFragment = graphql`
  fragment softwareDetailHeader_software on Software {
    id
    name
    autoUpdate
  }
`;

/**
 * The page title IS the record. Null for an unknown id — the Back button is drawn either way.
 *
 * "Update Software" (design 1100:444) updates this title through the package that manages it, which the server picks
 * per device; a title no package manager manages has nothing to update it with, so it gets no button.
 */
export function SoftwareDetailHeader({ software }: { software: softwareDetailHeader_software$key | null | undefined }) {
  const data = useFragment(softwareDetailHeaderFragment, software);
  return (
    <DetailTitle
      title={data?.name ?? SOFTWARE_DETAIL_TITLE}
      backTo={routes.software.list}
      actions={
        data && isManagedTitle(data.autoUpdate)
          ? [
              {
                label: SOFTWARE_ACTION_COPY.UPDATE.formTitle,
                variant: 'outline',
                href: routes.software.updateSoftware(data.id),
                icon: <Refresh02HrIcon size={24} className="text-ods-text-secondary" />,
              },
            ]
          : undefined
      }
    />
  );
}
