import { featureFlags } from './feature-flags';
import { isNativeShell } from './native-shell';

/**
 * Kill-switch for every payment-related surface in the app.
 *
 * Tied to `isNativeShell()`: the native app builds (Capacitor mobile, Tauri
 * desktop) hide payments, the web app keeps them. OpenFrame is billed through
 * Stripe on the web, and an app distributed as a native binary must not carry
 * that flow:
 *   - App Store Review Guideline 3.1.1 forbids showing prices, plans, or any
 *     button/link steering the user to a purchase outside In-App Purchase.
 *   - Google Play requires Play Billing for in-app purchases of digital
 *     subscriptions; opening Stripe Checkout from the app reads as bypassing it.
 * So the native builds ship with no plan picker, no "Upgrade"/"Pay Overage"/
 * "Activate Subscription" CTA, no invoices, and no Stripe Checkout entry point.
 *
 * No env var backs this: `window.Capacitor` / the Tauri globals are injected by
 * the shell itself, so a native build can't forget to declare what it is, and
 * the web bundle can't be misconfigured into hiding its billing.
 *
 * What stays visible when billing is hidden: usage data (device/AI consumption
 * counters), which is account state rather than a purchasing mechanism.
 */
export function isBillingHidden(): boolean {
  return isNativeShell();
}

/**
 * Whether payment surfaces (plan selection, checkout, invoices, cancellation,
 * subscription CTAs) may render: the tenant must have the server-side `billings`
 * flag AND the build must be allowed to show payments at all.
 *
 * Usage-only surfaces keep gating on `featureFlags.subscription.enabled()` —
 * they survive the native builds.
 */
export function isPaymentUiEnabled(): boolean {
  return featureFlags.subscription.enabled() && !isBillingHidden();
}
