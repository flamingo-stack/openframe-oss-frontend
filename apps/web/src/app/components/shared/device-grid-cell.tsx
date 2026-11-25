'use client';

import {
  GridTextWithDetailCell,
  renderDeviceTypeIcon,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

interface DeviceGridCellProps {
  name: string | undefined;
  deviceType: string | null | undefined;
  /** What a card row prints beside or under the device (its customer, when it was last online). */
  detail?: string;
}

/**
 * A device in a grid table's cell: its type icon, its name, then a detail on the same line. The name keeps its width
 * and the detail is the part a narrow column cuts: `DataTable.Cell`'s `secondary` cuts the other way round, so a long
 * host name gave way to a short "Last Online" or to its customer's name.
 */
export function DeviceGridCell({ name, deviceType, detail }: DeviceGridCellProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <span className="flex size-5 shrink-0 items-center justify-center text-ods-text-secondary">
        {renderDeviceTypeIcon(deviceType ?? undefined, 'size-5') ?? <MonitorIcon className="size-5" />}
      </span>
      <GridTextWithDetailCell text={name ?? ''} detail={detail} />
    </div>
  );
}
