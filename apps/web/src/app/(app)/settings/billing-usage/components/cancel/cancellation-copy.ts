/**
 * What cancelling does, for both dialogs of the flow. With a package the subscription runs to the end of the paid
 * term (PENDING_CANCELLATION) and keeps token purchases and auto top-up, only pay-as-you-go overage stops; pay-as-you-go
 * only ends at once and switches auto top-up off (see `hasSubscriptionPackage`).
 */
export const PACKAGE_CANCELLATION_TERMS =
  'Pay-as-you-go usage above your device package is disabled immediately. Token purchases and auto top-up stay available until then.';

export const PACKAGE_CANCELLED_OVERAGE = 'Pay-as-you-go usage above your device package is now disabled.';

export const PACKAGE_CANCELLED_PURCHASES = 'Token purchases and auto top-up stay available until then.';

export const PAYG_CANCELLATION_TERMS =
  'Your subscription ends as soon as you confirm. Auto top-up is turned off, and any usage already accrued is invoiced right away.';

export const PAYG_CANCELLED_TERMS =
  'Your subscription has ended. Auto top-up is now disabled, and any usage already accrued will be invoiced shortly.';
