'use client';

import { LockAltIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';

interface LockedScreenProps {
  /** Defaults to a padlock. */
  icon?: ReactNode;
  title: string;
  description: string;
  /** Buttons rendered under the copy. Laid out in a row from sm, stacked below it. */
  actions?: ReactNode;
}

/**
 * The centered card the app uses in place of page content when a surface cannot be
 * shown — an inactive workspace, a section only another role can open, or a segment
 * that failed to render (`app/error.tsx`).
 *
 * Presentation only: no status, no role, no copy of its own. It exists because the
 * callers differ solely in their icon, wording and buttons, and a second hand-rolled
 * copy of this markup would drift from the first the next time either is touched.
 *
 * Keep it free of anything payment-shaped. One of its callers renders in the native
 * builds, where a plan, a price or a purchase CTA is exactly what must not appear
 * (App Store Guideline 3.1.1 — see `billing-visibility.ts`); the copy each caller
 * passes is what carries that responsibility, and this must not add to it.
 */
export function LockedScreen({ icon, title, description, actions }: LockedScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-[var(--spacing-system-l)]">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)] text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary">
          {icon ?? <LockAltIcon className="size-8" />}
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <h1 className="text-ods-text-primary text-h2">{title}</h1>
          <p className="text-ods-text-secondary text-h4">{description}</p>
        </div>

        {actions && (
          <div className="flex w-full flex-col gap-[var(--spacing-system-s)] sm:w-auto sm:flex-row">{actions}</div>
        )}
      </div>
    </div>
  );
}
