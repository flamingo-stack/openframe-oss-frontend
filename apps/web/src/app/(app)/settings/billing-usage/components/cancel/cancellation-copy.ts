/**
 * What cancelling does, for both dialogs of the flow. With a package the subscription runs to the end of the paid
 * term (PENDING_CANCELLATION); pay-as-you-go only ends at once (see `hasSubscriptionPackage`).
 */
export const PACKAGE_CANCELLATION_TERMS =
  'Until then your devices, monthly free AI tokens, token purchases and auto top-up stay active, and usage above your device package is blocked instead of billed. Purchased tokens stay on your account.';

export const PAYG_CANCELLATION_TERMS =
  'A pay-as-you-go subscription ends as soon as you confirm: access stops immediately, auto top-up is switched off, and the usage accrued so far is invoiced right away.';

export const PAYG_CANCELLED_TERMS =
  'Your subscription has ended. Auto top-up is switched off, and the usage accrued so far will be invoiced shortly.';
