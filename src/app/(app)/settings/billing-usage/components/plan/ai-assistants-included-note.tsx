'use client';

import { MagicWandIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

/**
 * States what the plan picker's prices do NOT need to say: the assistants come
 * with the product, so nothing on this page is the thing that buys them.
 *
 * The wording follows the token-bank model this app ships — every paid plan
 * grants free tokens each month, and use beyond them draws from a balance the
 * tenant tops up.
 */
export function AiAssistantsIncludedNote() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)]">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-ods-border bg-ods-card">
        <MagicWandIcon className="size-6 text-ods-text-primary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-ods-text-primary text-h3">AI Assistants are Included</p>
        <p className="text-ods-text-secondary text-h6">
          Fae and Mingo are already built in. Each paid plan includes a monthly limit of free tokens to run them on all
          supported models.
        </p>
      </div>
    </div>
  );
}
