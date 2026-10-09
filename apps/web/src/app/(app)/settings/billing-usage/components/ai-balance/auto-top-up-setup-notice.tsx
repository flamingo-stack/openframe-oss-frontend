'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { openExternalTab } from '../shared/stripe-window';

/**
 * Enabling was refused for want of a card. Automatic charges need a payment
 * method that works with nobody present, which a wallet is not; nothing was
 * saved, and the arrangement is armed once the customer comes back from Stripe
 * and saves again.
 *
 * A real click opens the page: the URL arrived in a mutation's answer, so a tab
 * opened from THAT would be a blocked popup.
 */
export function AutoTopUpSetupNotice({ setupUrl }: { setupUrl: string }) {
  return (
    <div className="flex flex-col items-start gap-[var(--spacing-system-xs)] rounded-md border border-ods-warning bg-ods-card p-[var(--spacing-system-m)]">
      <p className="font-bold text-ods-text-primary text-h3">A card on file is needed first.</p>
      <p className="text-ods-text-secondary text-h4">
        Automatic top-ups charge a saved card while nobody is around to confirm. Add one in Stripe, then save auto
        top-up again.
      </p>
      <Button variant="outline" size="small" rightIcon={<ExternalLinkIcon />} onClick={() => openExternalTab(setupUrl)}>
        Add Payment Method
      </Button>
    </div>
  );
}
