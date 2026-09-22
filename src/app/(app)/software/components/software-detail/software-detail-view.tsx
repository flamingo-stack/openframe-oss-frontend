'use client';

import { memo, Suspense } from 'react';
import { SoftwareDetailContent } from './software-detail-content';
import { SoftwareDetailSkeleton } from './software-detail-skeleton';
import { SoftwareDetailTabs } from './software-detail-tabs';

interface SoftwareDetailViewProps {
  softwareId: string;
  /** The module's flag has not answered yet: the frame draws, nothing fetches. */
  loading?: boolean;
}

/**
 * Software details page.
 *
 * Deliberately NOT `PageLayout`: it takes its header content as props, so a page
 * whose title is the record itself would suspend as a whole and every visit
 * would start as a full-page placeholder. This draws `PageLayout`'s own box and
 * composes the frozen `TitleBlock` inside the content, so only what reads the
 * record waits.
 *
 * The tabs read nothing off the record — their lists fetch by id — so they sit
 * BESIDE the record's island, not behind it: the strip, the search bar and the
 * list's own skeleton are on screen from the first paint, and the list's query
 * runs alongside the record's instead of after it.
 */
export const SoftwareDetailView = memo(function SoftwareDetailViewImpl({
  softwareId,
  loading = false,
}: SoftwareDetailViewProps) {
  return (
    // The page padding lives on the wrapper around `ContentErrorBoundary` (see
    // `details/page.tsx`), so a thrown query keeps the chrome indented.
    <div className="flex w-full flex-col">
      {loading ? (
        <SoftwareDetailSkeleton />
      ) : (
        <Suspense fallback={<SoftwareDetailSkeleton />}>
          <SoftwareDetailContent softwareId={softwareId} />
        </Suspense>
      )}

      {/* `TabNavigation` renders as a fragment, so its bar and its body are
          siblings — grouped into ONE flex item, spaced off the card above. Each
          tab body owns the padding under the bar. */}
      <div className="flex flex-1 flex-col pt-[var(--spacing-system-l)]">
        <SoftwareDetailTabs softwareId={softwareId} loading={loading} />
      </div>
    </div>
  );
});
SoftwareDetailView.displayName = 'SoftwareDetailView';
