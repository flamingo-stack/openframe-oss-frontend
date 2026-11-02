import { graphql, readInlineData } from 'react-relay';
import type { subscriptionPackage_subscription$key } from '@/__generated__/subscriptionPackage_subscription.graphql';
import { BillingPeriod } from '@/generated/schema-enums';

/**
 * Whether the subscription carries a package Stripe bills on a cycle — the
 * question that decides how a cancellation behaves:
 *   - with one, the subscription runs to the end of the paid term
 *     (PENDING_CANCELLATION) and keeps token purchases and auto top-up until then;
 *   - without one (pay-as-you-go only), it ends the moment it is confirmed and
 *     the usage accrued so far is invoiced right away.
 *
 * Asked exactly the way the backend asks it (`hasSubscriptionPackage` in
 * saas-lib's `SubscriptionAllowanceUtils`): any package option on any product
 * whose period is not UNLIMITED, whatever its status. The prepaid UNLIMITED
 * package the AI product always carries renews nothing, so it does not count.
 */
const subscriptionPackageFragment = graphql`
  fragment subscriptionPackage_subscription on SubscriptionDetail @inline {
    products {
      packageOptions {
        billingPeriod
      }
    }
  }
`;

export function hasSubscriptionPackage(ref: subscriptionPackage_subscription$key): boolean {
  const { products } = readInlineData(subscriptionPackageFragment, ref);
  return products.some(product =>
    product.packageOptions.some(option => option.billingPeriod !== BillingPeriod.UNLIMITED),
  );
}
