'use client';

import {
  DeviceConnectivityIcon,
  DeviceLifecycleTag,
  DeviceTypeTile,
  getDeviceName,
  SOFTWARE_SOURCE_LABEL,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceCell_machine$key } from '@/__generated__/softwareDeviceCell_machine.graphql';
import { ValueText } from '@/app/components/shared';
import { SoftwareSource } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

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

/**
 * DEVICE column: the type icon, the name with its status chip, the customer underneath. On a phone the line under the
 * name says how the copy got there instead (1239:20463: "Installed manually", "Installed by Winget"): the Installed By
 * column is hidden there.
 */
export function SoftwareDeviceCell({
  machine,
  installedBy,
}: {
  machine: softwareDeviceCell_machine$key;
  /** The copy's source (`SoftwareOnDevice.installedBy`), for the phone's line. */
  installedBy?: string | null;
}) {
  // A row still being read (a loading scope) has no fragment to read: the tile, the name and the customer draw their bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareDeviceCellFragment, loading ? null : machine);
  const customer = data?.organization?.name;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      {/* Whether the device is online right now (Figma 3324-6819); its lifecycle is the tag beside the name, from tablet
          width up: the phone frame (1239:20463) draws none, so the name keeps the row. */}
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
            <DeviceLifecycleTag
              status={data.status}
              connectivity={data.connectivity ?? null}
              className="hidden shrink-0 content-md:inline-flex"
              data-loading-optional
            />
          )}
        </div>
        {(loading || customer) && (
          <TruncateText variant="h6" tone="secondary" className="hidden content-md:block">
            {customer ?? ''}
          </TruncateText>
        )}
        {data && installedBy && (
          <TruncateText variant="h6" tone="secondary" className="content-md:hidden">
            {installedByLine(installedBy)}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The phone's line under the name: "Installed manually" for a copy no package manager put there. */
function installedByLine(source: string): string {
  if (source === SoftwareSource.UNMANAGED) return 'Installed manually';
  return `Installed by ${presentationFor(SOFTWARE_SOURCE_LABEL, source) ?? source}`;
}
