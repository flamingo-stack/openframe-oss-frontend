'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';

/** Stand-in for the Needs approval page in the Mingo-first shell. Replaced by stream C1. */
export function ApprovalsPlaceholder() {
  return (
    <PageLayout title="Needs Approval" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <p className="text-ods-text-secondary text-h6">Needs approval — coming in C1.</p>
    </PageLayout>
  );
}
