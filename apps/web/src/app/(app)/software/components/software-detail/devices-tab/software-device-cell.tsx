'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import {
  DeviceTypeTile,
  getDeviceName,
  getDeviceStatusConfig,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceCell_machine$key } from '@/__generated__/softwareDeviceCell_machine.graphql';
import { ValueText } from '@/app/components/shared';

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
  // A row still being read (a loading scope) has no fragment to read: the tile, the name and the customer draw their bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareDeviceCellFragment, loading ? null : machine);
  const statusConfig = data?.status ? getDeviceStatusConfig(data.status) : null;
  const customer = data?.organization?.name;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      <DeviceTypeTile type={data?.type} />
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <ValueText
            value={
              data && getDeviceName({ nickname: data.nickname, displayName: data.displayName, hostname: data.hostname })
            }
          />
          {statusConfig && <Tag label={statusConfig.label} variant={statusConfig.variant} />}
        </div>
        {(loading || customer) && (
          <TruncateText variant="h6" tone="secondary">
            {customer ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}
