'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';

/**
 * Shown in place of the Billing & Usage pages to anyone who is not the workspace
 * owner, INSTEAD of the 404 every other closed route returns.
 *
 * A role refusal is not a missing page: the section exists, it is simply someone
 * else's to open, and the hub already hides its card — so the only way here is a
 * bookmark or a shared link, exactly the case where "this page could not be found"
 * tells the reader nothing and sends them looking for a broken URL. A definitive
 * `billings === 'off'` still 404s: there the section genuinely does not exist for
 * the tenant, and saying otherwise would leak what the tenant hasn't bought.
 *
 * Wording splits on `isBillingHidden()` for the same reason the card does: in the
 * native builds this route is a usage view with no payment surface at all, and its
 * copy must not name a subscription or payment (App Store Guideline 3.1.1 — see
 * `billing-visibility.ts`).
 */
export function BillingOwnerOnlyScreen() {
  const hidden = isBillingHidden();

  return (
    <LockedScreen
      title={hidden ? 'Usage is owner-only' : 'Billing is owner-only'}
      description={
        hidden
          ? 'Your workspace owner manages this workspace. Contact them if something here needs to change.'
          : 'Your workspace owner manages the subscription and payment details for this workspace. Contact them if something needs to change.'
      }
      actions={
        <Button variant="outline" href={routes.settings.root()}>
          Back to Settings
        </Button>
      }
    />
  );
}
