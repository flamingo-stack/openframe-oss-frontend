'use client';

import { graphql, useFragment } from 'react-relay';
import type { purchasedTokenPacks_subscription$key } from '@/__generated__/purchasedTokenPacks_subscription.graphql';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { formatUtcDay } from '@/lib/format-date';
import { formatCompactCount } from '@/lib/format-number';
import { BillingRow, SectionBlock } from '../shared/billing-section';

const purchasedTokenPacksFragment = graphql`
  fragment purchasedTokenPacks_subscription on SubscriptionDetail {
    usage {
      # Oldest first, the order tokens are spent in; expired packs are not listed.
      # validUntil is the date the invoice prints. expiresAt is the instant after
      # it, so it is not read here.
      purchasedTokenPacks {
        purchasedAt
        tokensPurchased
        tokensRemaining
        validUntil
      }
    }
  }
`;

/**
 * Every pack that can still be spent, as the API lists them, with the date each one lapses (Payment Terms 5.4).
 *
 * The figures are per pack, before any debt is settled, so they can add up to more than the balance on the card
 * above: nothing here totals them.
 */
export function PurchasedTokenPacks({ subscription }: { subscription: purchasedTokenPacks_subscription$key }) {
  const data = useFragment(purchasedTokenPacksFragment, subscription);
  const packs = data.usage?.purchasedTokenPacks ?? [];

  if (packs.length === 0) return null;

  return (
    <SectionBlock title="Purchased Tokens">
      <ul className="flex flex-col gap-[var(--spacing-system-sf)]">
        {packs.map(pack => (
          <li key={pack.purchasedAt}>
            <BillingRow
              label={`${formatCompactCount(pack.tokensRemaining)} / ${formatCompactCount(pack.tokensPurchased)}`}
              value={pack.validUntil ? `Valid until ${pack.validUntil}` : <EmptyValue />}
            />
            <p className="text-ods-text-secondary text-h6">Purchased {formatUtcDay(pack.purchasedAt)}</p>
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}
