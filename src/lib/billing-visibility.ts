import { featureFlags } from './feature-flags';
import { isMobileApp } from './mobile-app';

/**
 * Kill-switch for every payment-related surface in the app.
 *
 * OpenFrame is billed through Stripe on the web, and both mobile stores object
 * to that being reachable from an app they distribute:
 *   - App Store Review Guideline 3.1.1 forbids showing prices, plans, or any
 *     button/link steering the user to a purchase outside In-App Purchase.
 *   - Google Play requires Play Billing for in-app purchases of digital
 *     subscriptions; opening Stripe Checkout from the app reads as bypassing it.
 * So the mobile bundles ship with no plan picker, no "Upgrade"/"Pay Overage"/
 * "Activate Subscription" CTA, no invoices, and no Stripe Checkout entry point.
 *
 * Tied to `isMobileApp()` (`NEXT_PUBLIC_IS_MOBILE_APP`, platform fallback) —
 * the store bundles are exactly the builds under those rules. The web app and
 * the desktop shell, which ship outside any store, keep the full billing UI.
 *
 * What stays visible when billing is hidden: usage data (device/AI consumption
 * counters), which is account state rather than a purchasing mechanism.
 */
export function isBillingHidden(): boolean {
  return isMobileApp();
}

/**
 * Whether payment surfaces (plan selection, checkout, invoices, cancellation,
 * subscription CTAs) may render: the tenant must have the server-side `billings`
 * flag AND the platform must allow payment UI at all.
 *
 * Usage-only surfaces keep gating on `featureFlags.subscription.enabled()` —
 * they survive the store build.
 */
export function isPaymentUiEnabled(): boolean {
  return featureFlags.subscription.enabled() && !isBillingHidden();
}
