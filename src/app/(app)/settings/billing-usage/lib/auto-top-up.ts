/**
 * Whether the AI balance refills itself.
 *
 * The backend has nowhere to keep that choice yet: `purchaseTokens` is a single
 * purchase, and no field on `SubscriptionDetail` records a standing order to
 * repeat it. So every surface reads one answer — off, and not switchable — and
 * the UI the mockups draw for the feature is in place, waiting on the API rather
 * than on a second pass of design work: the checkbox in Manage AI Balance, the
 * refresh mark on the Paid AI Tokens counter, the first line of the model rates
 * popover. When the subscription grows the field, read it here and drop the
 * constant; the surfaces need no change.
 */
export interface AutoTopUpStatus {
  /** The backend can store the choice, so the checkbox is live. */
  available: boolean;
  /** The balance refills itself today. Never `true` while unavailable. */
  enabled: boolean;
}

export const AUTO_TOP_UP: AutoTopUpStatus = { available: false, enabled: false };

/** The checkbox's second line, from the mockup. */
export const AUTO_TOP_UP_DESCRIPTION =
  'Automatically refill your balance with the selected amount whenever it runs out.';
