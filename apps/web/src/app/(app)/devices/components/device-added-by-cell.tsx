'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { AddedByFrame } from './device-added-by-frame';
import { DeviceAddedByUser } from './device-added-by-user';

/** Same frame with the avatar and the name as placeholders; the label is the real text. */
export function DeviceAddedByCellSkeleton() {
  return (
    <AddedByFrame avatar={<Skeleton className="size-8 shrink-0 rounded-full" />}>
      <span className="relative inline-block w-28 align-middle text-h4">
        {/* Invisible char establishes the real line-box height of the name. */}
        <span className="invisible" aria-hidden>
          &nbsp;
        </span>
        <Skeleton className="absolute left-0 right-0 top-1/2 h-[0.85em] -translate-y-1/2 rounded-[6px]" />
      </span>
    </AddedByFrame>
  );
}

function AddedByNobody() {
  return (
    <AddedByFrame>
      <div className="min-w-0 text-h4">
        <EmptyValue />
      </div>
    </AddedByFrame>
  );
}

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
    return <AddedByNobody />;
  }
  return (
    <ContentErrorBoundary resetKey={userId} fallback={() => <AddedByNobody />}>
      <Suspense fallback={<DeviceAddedByCellSkeleton />}>
        <DeviceAddedByUser userId={userId} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
