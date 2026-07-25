'use client';

import { PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { HelpCenterMenu } from './help-center-menu';

/**
 * Route-level skeletons for the Help Center.
 *
 * The index has no request behind it, so its "loading" state renders the REAL
 * menu — there is nothing to shimmer and nothing shifts when the page mounts.
 * The document pages are lib-owned (`help-center-pages`) and all share the same
 * chrome: an `h1` title with a "Back to Help Center" button.
 */

const noop = () => {};
const DOC_BLOCK_KEYS = ['a', 'b', 'c', 'd'] as const;

export function HelpCenterPageSkeleton() {
  return (
    <PageLayout title="Help Center" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <HelpCenterMenu />
    </PageLayout>
  );
}

export function HelpCenterDocSkeleton() {
  return (
    <PageLayout
      loading
      titleSize="h1"
      // Truthy placeholder: `TitleBlock` only draws the subtitle skeleton bar
      // when `subtitle` is set, and every help-center document page has one.
      subtitle=" "
      backButton={{ label: 'Back to Help Center', onClick: noop }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {DOC_BLOCK_KEYS.map(key => (
        <Skeleton key={key} className="h-24 w-full rounded-[6px]" />
      ))}
    </PageLayout>
  );
}
