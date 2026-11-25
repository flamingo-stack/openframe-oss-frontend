'use client';

import {
  DeviceConnectivityIcon,
  DeviceLifecycleTag,
  DeviceTypeTile,
  getDeviceName,
  renderDeviceTypeIcon,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { DataTable, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceCell_machine$key } from '@/__generated__/softwareDeviceCell_machine.graphql';
import { ValueText } from '@/app/components/shared';

const softwareDeviceCellFragment = graphql`
  fragment softwareDeviceCell_machine on Machine {
    nickname
    displayName
    hostname
    status
    connectivity
    lastSeen
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
  const customer = data?.organization?.name;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      {/* Whether the device is online right now (Figma 3324-6819); its lifecycle is the tag beside the name. */}
      <DeviceConnectivityIcon
        connectivity={data?.connectivity}
        lastSeen={data?.lastSeen}
        legacyIcon={<DeviceTypeTile type={data?.type} />}
      />
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <ValueText
            value={
              data && getDeviceName({ nickname: data.nickname, displayName: data.displayName, hostname: data.hostname })
            }
          />
          {data?.status && (
            <DeviceLifecycleTag status={data.status} connectivity={data.connectivity ?? null} data-loading-optional />
          )}
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

/**
 * DEVICE column in the grid layout: one line, the connectivity icon (the type icon in the legacy display), the name,
 * its status chip, then the customer.
 */
export function SoftwareDeviceGridCell({ machine }: { machine: softwareDeviceCell_machine$key }) {
  // A row still being read (a loading scope) has no fragment to read: the icon and the name draw their loading forms.
  const data = useFragment(softwareDeviceCellFragment, useLoadingScope() ? null : machine);
  return (
    <DataTable.Cell
      leading={{
        type: 'icon',
        icon: (
          <DeviceConnectivityIcon
            connectivity={data?.connectivity}
            lastSeen={data?.lastSeen}
            size={20}
            className="size-5"
            legacyIcon={renderDeviceTypeIcon(data?.type ?? undefined, 'size-5')}
          />
        ),
      }}
      text={
        data ? getDeviceName({ nickname: data.nickname, displayName: data.displayName, hostname: data.hostname }) : ''
      }
      tag={data?.status && <DeviceLifecycleTag status={data.status} connectivity={data.connectivity ?? null} />}
      secondary={data?.organization?.name ?? undefined}
    />
  );
}
