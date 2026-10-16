'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { AddedByFrame } from './device-added-by-frame';

/**
 * The "Added by" cell with the avatar and the name as placeholders; the label is the real text.
 * `region={false}` inside another loading region, which announces for the cell.
 */
export function DeviceAddedByCellSkeleton({ region = true }: { region?: boolean } = {}) {
  return (
    <LoadingRegion className="contents" label="Loading who added the device" announce={region}>
      <AddedByFrame avatar={<UnifiedSkeleton className="size-8 shrink-0 rounded-full" />}>
        <span className="relative inline-block w-28 align-middle text-h4">
          {/* Invisible char establishes the real line-box height of the name. */}
          <span className="invisible" aria-hidden>
            &nbsp;
          </span>
          <UnifiedSkeleton className="absolute left-0 right-0 top-1/2 h-[0.85em] -translate-y-1/2 rounded-[6px]" />
        </span>
      </AddedByFrame>
    </LoadingRegion>
  );
}
