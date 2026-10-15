import { describe, expect, it } from 'vitest';
import { isLockingStatus, isRouteOpenWhileLocked, SubscriptionStatus } from './subscription-status';

describe('isLockingStatus', () => {
  it('locks on PAST_DUE as well as the other unpaid states', () => {
    expect(isLockingStatus(SubscriptionStatus.PAST_DUE)).toBe(true);
    expect(isLockingStatus(SubscriptionStatus.SUSPENDED)).toBe(true);
    expect(isLockingStatus(SubscriptionStatus.TRIAL_EXPIRED)).toBe(true);
    expect(isLockingStatus(SubscriptionStatus.CANCELED)).toBe(true);
  });

  it('leaves a paying workspace open', () => {
    expect(isLockingStatus(SubscriptionStatus.ACTIVE)).toBe(false);
    expect(isLockingStatus(SubscriptionStatus.TRIAL)).toBe(false);
    expect(isLockingStatus(SubscriptionStatus.PENDING_CANCELLATION)).toBe(false);
  });
});

describe('isRouteOpenWhileLocked', () => {
  it('keeps Billing & Usage open on PAST_DUE, with or without the trailing slash', () => {
    expect(isRouteOpenWhileLocked('/settings/billing-usage', SubscriptionStatus.PAST_DUE)).toBe(true);
    expect(isRouteOpenWhileLocked('/settings/billing-usage/', SubscriptionStatus.PAST_DUE)).toBe(true);
  });

  it('locks Billing & Usage with the rest on every other lock', () => {
    expect(isRouteOpenWhileLocked('/settings/billing-usage/', SubscriptionStatus.SUSPENDED)).toBe(false);
    expect(isRouteOpenWhileLocked('/settings/billing-usage/', SubscriptionStatus.TRIAL_EXPIRED)).toBe(false);
    expect(isRouteOpenWhileLocked('/settings/billing-usage/', SubscriptionStatus.CANCELED)).toBe(false);
  });

  it('locks the rest of the dashboard on PAST_DUE', () => {
    expect(isRouteOpenWhileLocked('/dashboard/', SubscriptionStatus.PAST_DUE)).toBe(false);
    expect(isRouteOpenWhileLocked('/settings/', SubscriptionStatus.PAST_DUE)).toBe(false);
    expect(isRouteOpenWhileLocked('/settings/employees/', SubscriptionStatus.PAST_DUE)).toBe(false);
  });

  it('keeps the checkout result pages open on any lock', () => {
    expect(isRouteOpenWhileLocked('/checkout/success/', SubscriptionStatus.TRIAL_EXPIRED)).toBe(true);
    expect(isRouteOpenWhileLocked('/checkout/cancel/', SubscriptionStatus.PAST_DUE)).toBe(true);
  });

  it('locks while the pathname is unknown', () => {
    expect(isRouteOpenWhileLocked(null, SubscriptionStatus.PAST_DUE)).toBe(false);
  });
});
