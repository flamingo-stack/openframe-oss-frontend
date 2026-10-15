'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';

/** Stand-in for the archived chats page in the Mingo-first shell. Replaced by stream B2. */
export function MingoArchivePlaceholder() {
  return (
    <PageLayout title="Chat Archive" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <p className="text-ods-text-secondary text-h6">Chat archive — coming in B2.</p>
    </PageLayout>
  );
}
