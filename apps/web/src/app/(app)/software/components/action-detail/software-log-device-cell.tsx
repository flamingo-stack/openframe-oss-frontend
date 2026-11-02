'use client';

import {
  DeviceTypeTile,
  formatLastOnline,
  getDeviceName,
  getDeviceStatusConfig,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Tag, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogDeviceCell_machine$key } from '@/__generated__/softwareLogDeviceCell_machine.graphql';
import { ValueText } from '@/app/components/shared';

const softwareLogDeviceCellFragment = graphql`
  fragment softwareLogDeviceCell_machine on Machine {
    nickname
    displayName
    hostname
    status
    type
    lastSeen
  }
`;

/** DEVICE column: the type tile, the name with its status chip, when it was last online. */
export function SoftwareLogDeviceCell({ machine }: { machine: softwareLogDeviceCell_machine$key | null | undefined }) {
  // A row still being read (a loading scope) has no fragment to read: the tile, the name and the last-online line
  // draw their bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareLogDeviceCellFragment, loading ? null : machine);
  const status = data?.status ? getDeviceStatusConfig(data.status) : null;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      <DeviceTypeTile type={data?.type} />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <div className="min-w-0">
            <ValueText
              value={getDeviceName({
                nickname: data?.nickname,
                displayName: data?.displayName,
                hostname: data?.hostname,
              })}
            />
          </div>
          {status && <Tag label={status.label} variant={status.variant} />}
        </div>
        <TruncateText variant="h6" tone="secondary" loading={loading}>
          {formatLastOnline(data?.lastSeen)}
        </TruncateText>
      </div>
    </div>
  );
}
