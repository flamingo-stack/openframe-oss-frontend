'use client';

import { PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';

const GENERIC_BLOCK_KEYS = ['a', 'b', 'c'] as const;

/**
 * Fallback for routes with no dedicated skeleton (create/edit forms, checkout,
 * legacy scripts): the real `PageLayout` header in its loading state plus
 * neutral content blocks — the shape every page shares, with nothing
 * page-specific that could be wrong.
 *
 * Used by the app-shell placeholder and as the last-resort Suspense fallback in
 * the live shell — the two spots where no route is known yet. A page that IS
 * known renders its own skeleton.
 */
export function GenericPageSkeleton() {
  return (
    <PageLayout loading className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      {GENERIC_BLOCK_KEYS.map(key => (
        <Skeleton key={key} className="h-20 w-full rounded-[6px]" />
      ))}
    </PageLayout>
  );
}
