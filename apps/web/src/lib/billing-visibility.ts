import { featureFlags } from './feature-flags';
import { isDesktopShell, isMobileShell } from './platform';
import { routes } from './routes';
import { runtimeEnv } from './runtime-config';

/**
 * How much of billing a build may show. Three tiers, keyed on the shell:
 *
 *   - web — everything: plans, prices, invoices, checkout, cancellation.
 *   - desktop (Tauri) — read-only, see `isBillingReadOnly()`.
 *   - mobile (Capacitor) — nothing, see `isBillingHidden()`.
 *
 * No env var backs this: `window.Capacitor` / the Tauri globals are injected by
 * the shell itself, so a native build can't forget to declare what it is, and
 * the web bundle can't be misconfigured into hiding its billing.
 */

/**
 * Kill-switch for every payment-related surface, on the phone builds only.
 *
 * OpenFrame is billed through Stripe on the web, and an app distributed through
 * a store must not carry that flow:
 *   - App Store Review Guideline 3.1.1 forbids showing prices, plans, or any
 *     button/link steering the user to a purchase outside In-App Purchase.
 *   - Google Play requires Play Billing for in-app purchases of digital
 *     subscriptions; opening Stripe Checkout from the app reads as bypassing it.
 * So the mobile builds ship with no plan picker, no "Upgrade"/"Pay Overage"/
 * "Activate Subscription" CTA, no invoices, and no Stripe Checkout entry point.
 *
 * `isMobileShell()`, NOT `isAppShell()`: the desktop build ships outside any
 * store, so neither rule reaches it, and hiding billing there left an MSP with
 * usage counters and no way to see what they pay or where to change it.
 *
 * What stays visible when billing is hidden: usage data (device/AI consumption
 * counters), which is account state rather than a purchasing mechanism.
 */
export function isBillingHidden(): boolean {
  return isMobileShell();
}

/**
 * The desktop build shows everything about the money — plan, rates, next
 * payment, usage against allowance, invoices — and changes none of it. Every
 * action that would (plan change, checkout, AI limit, cancellation, paying an
 * invoice) is replaced by one "Manage Billing" exit to the web app, see
 * `openBillingInBrowser()`. Payment stays in the browser, where bank
 * verification steps, autofill and saved cards work.
 */
export function isBillingReadOnly(): boolean {
  return isDesktopShell();
}

/**
 * Whether purchase surfaces (plan selection, checkout, cancellation,
 * subscription CTAs) may render: the tenant must have the server-side `billings`
 * flag AND the build must be allowed to change billing at all.
 *
 * Usage-only surfaces keep gating on `featureFlags.subscription.enabled()` —
 * they survive the native builds.
 */
export function isPaymentUiEnabled(): boolean {
  return featureFlags.subscription.enabled() && !isBillingHidden() && !isBillingReadOnly();
}

/**
 * The read-only build's one way out: the web app's own billing page, in the
 * system browser. The web page rather than the Stripe portal because the portal
 * exposes neither plan changes nor cancellation, and this exit has to cover
 * anything the user may want to change.
 *
 * A plain `window.open` of a known https URL: the desktop shell routes external
 * links to the default browser. Deliberately not `openDeferredTab()` — its blank
 * placeholder tab is denied by the shell, and its fallback then navigates the
 * app window itself.
 */
export function openBillingInBrowser(): void {
  const origin = runtimeEnv.tenantHostUrl().replace(/\/+$/, '');
  // Trailing slash: the canonical form under `trailingSlash: true`, so the link
  // never depends on how the web deployment treats the bare path.
  window.open(`${origin}${routes.settings.billingUsage}/`, '_blank', 'noopener,noreferrer');
}
