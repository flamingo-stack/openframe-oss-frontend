'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceCell_machine$key } from '@/__generated__/softwareDeviceCell_machine.graphql';
import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
import { getDeviceStatusConfig } from '@/app/(app)/devices/utils/device-status';
import { ValueText } from '@/app/components/shared';
import { DeviceTypeTile } from '@/app/components/shared/device-type-tile';

const softwareDeviceCellFragment = graphql`
  fragment softwareDeviceCell_machine on Machine {
    nickname
    displayName
    hostname
    status
    type
    organization {
      name
    }
  }
`;

/** DEVICE column: the type icon, the name with its status chip, the customer underneath. */
export function SoftwareDeviceCell({ machine }: { machine: softwareDeviceCell_machine$key }) {
  const { nickname, displayName, hostname, status, type, organization } = useFragment(
    softwareDeviceCellFragment,
    machine,
  );
  const statusConfig = status ? getDeviceStatusConfig(status) : null;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      <DeviceTypeTile type={type} />
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <ValueText value={getDeviceName({ nickname, displayName, hostname })} />
          {statusConfig && <Tag label={statusConfig.label} variant={statusConfig.variant} />}
        </div>
        {organization?.name && (
          <TruncateText variant="h6" tone="secondary">
            {organization.name}
          </TruncateText>
        )}
      </div>
    </div>
  );
}
