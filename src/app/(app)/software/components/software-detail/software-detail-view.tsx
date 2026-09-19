'use client';

import { memo, Suspense } from 'react';
import { SoftwareDetailContent } from './software-detail-content';
import { SoftwareDetailSkeleton } from './software-detail-skeleton';

interface SoftwareDetailViewProps {
  softwareId: string;
}

/**
 * Software details page.
 *
 * Deliberately NOT `PageLayout`: it takes its header content as props, so a page
 * whose title is the record itself would suspend as a whole and every visit
 * would start as a full-page placeholder. This draws `PageLayout`'s own box and
 * composes the frozen `TitleBlock` inside the content, so only what reads the
 * record waits.
 */
export const SoftwareDetailView = memo(function SoftwareDetailViewImpl({ softwareId }: SoftwareDetailViewProps) {
  return (
    // The page padding lives on the wrapper around `ContentErrorBoundary` (see
    // `details/page.tsx`), so a thrown query keeps the chrome indented.
    <div className="flex w-full flex-col">
      <Suspense fallback={<SoftwareDetailSkeleton />}>
        <SoftwareDetailContent softwareId={softwareId} />
      </Suspense>
    </div>
  );
});
SoftwareDetailView.displayName = 'SoftwareDetailView';
