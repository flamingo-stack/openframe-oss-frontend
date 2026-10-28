/**
 * Package or pay-as-you-go, as the backend decides it when cancelling
 * (`SubscriptionAllowanceUtils.hasSubscriptionPackage`): the cancel dialogs
 * promise what that branch does (CU-17tkuw5zbq8, CU-17tkuw60c30).
 */
import { describe, expect, it, vi } from 'vitest';
import type { subscriptionPackage_subscription$key } from '@/__generated__/subscriptionPackage_subscription.graphql';
import { hasSubscriptionPackage } from './subscription-package';

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));

function subscription(...periods: Array<Array<string | null>>): subscriptionPackage_subscription$key {
  return {
    products: periods.map(options => ({ packageOptions: options.map(billingPeriod => ({ billingPeriod })) })),
  } as unknown as subscriptionPackage_subscription$key;
}

describe('hasSubscriptionPackage', () => {
  it('pay-as-you-go devices with the prepaid AI package: no package (the AI one renews nothing)', () => {
    expect(hasSubscriptionPackage(subscription([], ['UNLIMITED']))).toBe(false);
  });

  it('an annual device package: a package', () => {
    expect(hasSubscriptionPackage(subscription(['YEARLY'], ['UNLIMITED']))).toBe(true);
  });

  it('a monthly package on any product counts, and so does an option without a period', () => {
    expect(hasSubscriptionPackage(subscription(['MONTHLY']))).toBe(true);
    expect(hasSubscriptionPackage(subscription([null]))).toBe(true);
  });

  it('no products at all: no package', () => {
    expect(hasSubscriptionPackage(subscription())).toBe(false);
  });
});
