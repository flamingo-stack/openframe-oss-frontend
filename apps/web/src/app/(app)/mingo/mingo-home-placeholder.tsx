'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';

/** Stand-in for Mingo's home in the Mingo-first shell. Replaced by stream B4. */
export function MingoHomePlaceholder() {
  return (
    <PageLayout title="Mingo" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <p className="text-ods-text-secondary text-h6">Mingo home — coming in B4.</p>
    </PageLayout>
  );
}
