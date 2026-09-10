'use client';

import type { ReactNode } from 'react';

/**
 * The standalone frame for the "One Last Step" page: one centered card on the page background, with
 * no tabs and no benefits panel - the person is mid-flow, one click from being signed in, and there
 * is nothing to sell them. Same footprint as the invite-link notice, the other auth screen that
 * stands alone; the card itself is the shared `SsoJoinForm` (or its skeleton while the identity loads).
 */
export function SsoJoinCardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="w-full max-w-[600px]">{children}</div>
    </div>
  );
}
