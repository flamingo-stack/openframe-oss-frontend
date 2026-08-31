'use client';

import { MagicWandIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

/**
 * States what the plan picker's prices do NOT need to say: the assistants come
 * with the product, so nothing on this page is the thing that buys them.
 *
 * The wording follows the pay-as-you-go AI model this app ships — usage is
 * metered and billed after the fact, not bought up front as a token balance.
 */
export function AiAssistantsIncludedNote() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)]">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-ods-border bg-ods-card">
        <MagicWandIcon className="size-6 text-ods-text-primary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-h3 text-ods-text-primary">AI Assistants are Included</p>
        <p className="text-h6 text-ods-text-secondary">
          Fae and Mingo are already built in. Running them on any supported model is billed pay as you go, on top of
          your device plan.
        </p>
      </div>
    </div>
  );
}
