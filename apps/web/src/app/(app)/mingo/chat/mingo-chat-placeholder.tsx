'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';

/** Stand-in for one conversation as a page in the Mingo-first shell. Replaced by stream B2. */
export function MingoChatPlaceholder({ dialogId }: { dialogId: string }) {
  return (
    <PageLayout title="Mingo Chat" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <p className="text-ods-text-secondary text-h6">Chat {dialogId} — coming in B2.</p>
    </PageLayout>
  );
}
