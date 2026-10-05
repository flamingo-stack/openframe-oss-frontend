import { graphql, readInlineData } from 'react-relay';
import type { activePackage_subscriptionProduct$key } from '@/__generated__/activePackage_subscriptionProduct.graphql';
import { SubscriptionProductStatus } from '@/generated/schema-enums';

/**
 * The package in force on a product the subscription carries: the one option
 * whose status is ACTIVE.
 *
 * Three readers ask that question — the device counter's allocation, the plan
 * picker's opening state and the diff a plan change sends — and "in force" has
 * to mean one thing across them, so the lookup is written once and spread. What
 * it hands back is what those three read of the package: the count it commits
 * to, and the catalog option it was made against.
 *
 * `@inline`, because the readers are plain functions and a hook, not
 * components of their own. The plan sections read more of the package (its
 * period, rate and dates) through `planSchedule`, which is their own reader.
 */
const activePackageFragment = graphql`
  fragment activePackage_subscriptionProduct on SubscriptionProductDetail @inline {
    packageOptions {
      id
      # The catalog option this commitment was made against — what the update
      # mutation addresses a CANCEL by.
      packageOptionId
      quantity
      status
    }
  }
`;

export interface ActivePackage {
  packageOptionId: string;
  /** Devices the commitment covers. */
  quantity: number | null;
}

export function activePackage(ref: activePackage_subscriptionProduct$key): ActivePackage | null {
  const { packageOptions } = readInlineData(activePackageFragment, ref);
  const active = packageOptions.find(option => option.status === SubscriptionProductStatus.ACTIVE);
  return active ? { packageOptionId: active.packageOptionId, quantity: active.quantity ?? null } : null;
}
