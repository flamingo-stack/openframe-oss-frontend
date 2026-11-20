'use client';

import { DotsLoaderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { createContext, type ReactNode, use } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceAdoptionTag_softwareOnDevice$key } from '@/__generated__/softwareDeviceAdoptionTag_softwareOnDevice.graphql';
import { DeviceConnectivity, SoftwareAdoptionStatus } from '@/generated/schema-enums';

const softwareDeviceAdoptionTagFragment = graphql`
  fragment softwareDeviceAdoptionTag_softwareOnDevice on SoftwareOnDevice {
    adoption {
      status
      error
    }
    device {
      connectivity
    }
  }
`;

/**
 * The rows' adoption reads, by device id. Only the Devices query run with Adopt on selects `adoption`
 * (`softwareDevicesTableAdoptQuery`): a backend without Adopt rejects any operation that names it, even under a skipped
 * `@include`, so the cells' own fragments cannot carry it. That query hands its rows' references in here.
 */
export type SoftwareDeviceAdoptionRefs = ReadonlyMap<string, softwareDeviceAdoptionTag_softwareOnDevice$key>;

export const SoftwareDeviceAdoptionRefsContext = createContext<SoftwareDeviceAdoptionRefs | null>(null);

/**
 * The device's adoption of the title (design 1227:45730): ADOPTING, with "Starts when online" under it on an offline
 * device, or ADOPTION FAILED with the device's reason on hover. `fallback` (nothing by default) when there is no
 * adoption, while the row is read, or while Adopt is off: its read comes from the Adopt query, by device id
 * (`SoftwareDeviceAdoptionRefsContext`), which runs only with the flag on.
 */
export function SoftwareDeviceAdoptionTag({
  deviceId,
  className,
  fallback = null,
}: {
  /** The row's device; undefined while the row is read. */
  deviceId: string | undefined;
  /** Where it is drawn: the host's visibility for it, e.g. only while its own column is hidden. */
  className?: string;
  /** What the host draws in its place without an adoption. */
  fallback?: ReactNode;
}) {
  const refs = use(SoftwareDeviceAdoptionRefsContext);
  const data = useFragment(softwareDeviceAdoptionTagFragment, (deviceId && refs?.get(deviceId)) || null);
  const adoption = data?.adoption;

  if (adoption?.status === SoftwareAdoptionStatus.ADOPTING) {
    const offline = data?.device.connectivity === DeviceConnectivity.OFFLINE;
    return (
      // A row that wraps, not a column: one line in the grid layout, "Starts when online" under the chip in a narrow card.
      <div className={cn('flex min-w-0 flex-wrap items-center gap-[var(--spacing-system-xxs)]', className)}>
        <Tag label="Adopting" variant="warning" icon={<DotsLoaderIcon className="h-4 w-4" />} />
        {offline && <p className="truncate text-ods-text-secondary text-h6">Starts when online</p>}
      </div>
    );
  }
  if (adoption?.status === SoftwareAdoptionStatus.FAILED) {
    return (
      <div className={cn('flex min-w-0', className)}>
        <FloatingTooltip content={adoption.error} disabled={!adoption.error} as="span">
          <Tag label="Adoption failed" variant="error" />
        </FloatingTooltip>
      </div>
    );
  }
  return fallback;
}
