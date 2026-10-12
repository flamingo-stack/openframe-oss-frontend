'use client';

import { Suspense } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { DeviceAddedByCellSkeleton } from './device-added-by-cell-skeleton';
import { DeviceAddedByNobody } from './device-added-by-nobody';
import { DeviceAddedByUser } from './device-added-by-user';

interface DeviceAddedByCellProps {
  /** Id of the user whose install command enrolled the device. */
  userId?: string | null;
}

/**
 * Who added the device. The device carries only the user's id, so the name and
 * the avatar are read from the user's node.
 *
 * - no id (enrolled before the install command carried one): the empty mark;
 * - a failed read: the empty mark, with no toast. The cell is one detail of a
 *   page that has loaded, and an error raised from it would read as the device
 *   failing to load.
 */
export function DeviceAddedByCell({ userId }: DeviceAddedByCellProps) {
  if (!userId) {
    return <DeviceAddedByNobody />;
  }
  return (
    <ContentErrorBoundary resetKey={userId} fallback={() => <DeviceAddedByNobody />}>
      <Suspense fallback={<DeviceAddedByCellSkeleton />}>
        <DeviceAddedByUser userId={userId} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
