import { graphql, readInlineData } from 'react-relay';
import type { autoTopUpStatus_settings$key } from '@/__generated__/autoTopUpStatus_settings.graphql';
import { AutoTopUpDisabledReason, AutoTopUpPausedReason } from '@/generated/schema-enums';
import type { Instant } from '@/lib/graphql-scalars';

/**
 * The standing arrangement to buy more tokens before the bank empties, as every
 * surface reads it: the Paid AI Tokens card and its rates popover, the notice
 * under the cards, the Auto Top-up section, the Manage AI Balance modal — and
 * the mutation that sets it, so a field added for a reader is returned by the
 * write by construction.
 *
 * `@inline` because the readers are fed through props and a mutation callback,
 * not through fragments of their own.
 */
const autoTopUpStatusFragment = graphql`
  fragment autoTopUpStatus_settings on AutoTopUpSettings @inline {
    enabled
    amountUsd
    thresholdUsd
    spendLimitUsd
    spentLast30DaysUsd
    pausedReason
    resumesAt
    minimumAmountUsd
    minimumThresholdUsd
    disabledReason
    paymentMethodSetupUrl
  }
`;

/**
 * The smallest top-up that can be sent, in whole dollars, when the backend does
 * not say: the purchase, the arrangement and the checkout share one configured
 * floor, and only the arrangement's read (`minimumAmountUsd`) exposes it. The
 * one-time purchase on the paywall has no such read and keeps this.
 */
export const FALLBACK_MIN_TOP_UP_USD = 10;

export interface AutoTopUpStatus {
  /** The system may charge the card on file when the bank falls below the threshold. */
  enabled: boolean;
  /** What one automatic top-up charges, in whole dollars. Kept while it is off. */
  amountUsd: number | null;
  /** The balance, in whole dollars, that triggers a refill. Kept while it is off. */
  thresholdUsd: number | null;
  /** The most auto top-ups may charge over the last 30 days; `null` is no limit. Kept while it is off. */
  spendLimitUsd: number | null;
  /** What auto top-ups charged over the last 30 days, paid and in flight, failed ones excluded. */
  spentUsd: number;
  /**
   * The spend limit holds refills back. Auto top-up stays enabled; the next
   * refill is tried at `resumesAt`, and any save lifts the pause at once.
   */
  paused: boolean;
  /** While paused: when the next refill is tried. `null` otherwise. */
  resumesAt: Instant | null;
  /** The floor of a top-up amount, in whole dollars. */
  minimumAmountUsd: number;
  /** The floor of the threshold, in whole dollars. */
  minimumThresholdUsd: number;
  /**
   * Why the system switched it off over the card. `null` when the customer
   * switched it off, or it is on. A cancelled subscription is left out: the
   * lock screen says that.
   */
  switchedOff: SwitchedOffReason | null;
  /**
   * Where to add a card, set only when enabling was refused for want of one.
   * Nothing is saved then: the arrangement is armed once the customer comes
   * back from this page and saves again.
   */
  paymentMethodSetupUrl: string | null;
}

const SWITCHED_OFF_REASONS = [
  AutoTopUpDisabledReason.PAYMENT_FAILED,
  AutoTopUpDisabledReason.AUTHENTICATION_ABANDONED,
  AutoTopUpDisabledReason.NO_PAYMENT_METHOD,
] as const;

export type SwitchedOffReason = (typeof SWITCHED_OFF_REASONS)[number];

function isSwitchedOffReason(reason: string | null | undefined): reason is SwitchedOffReason {
  return SWITCHED_OFF_REASONS.some(r => r === reason);
}

/** What the notice under the cards and the modal's checkbox say for each reason. */
export const SWITCHED_OFF_COPY: Record<SwitchedOffReason, { notice: string; checkbox: string }> = {
  PAYMENT_FAILED: {
    notice:
      'The last automatic charge was declined, so your balance no longer refills itself. Update your card in the Customer Portal, then turn auto top-up back on.',
    checkbox: 'Switched off after a declined charge. Update your card in the Customer Portal, then turn it back on.',
  },
  AUTHENTICATION_ABANDONED: {
    notice:
      'Your bank asked to confirm the last automatic charge and nobody did, so your balance no longer refills itself. Turn auto top-up back on, or use a card that does not ask for confirmation.',
    checkbox:
      'Switched off after an unconfirmed charge. Turn it back on, or use a card that does not ask for confirmation.',
  },
  NO_PAYMENT_METHOD: {
    notice:
      'There is no card on file that can be charged automatically, so your balance no longer refills itself. Add a card, then turn auto top-up back on.',
    checkbox: 'Switched off: no card on file can be charged automatically. Add a card, then turn it back on.',
  },
};

export function toAutoTopUpStatus(ref: autoTopUpStatus_settings$key): AutoTopUpStatus {
  const data = readInlineData(autoTopUpStatusFragment, ref);
  const minimumAmountUsd = data.minimumAmountUsd ?? FALLBACK_MIN_TOP_UP_USD;
  return {
    enabled: data.enabled,
    amountUsd: data.amountUsd ?? null,
    thresholdUsd: data.thresholdUsd ?? null,
    spendLimitUsd: data.spendLimitUsd ?? null,
    spentUsd: data.spentLast30DaysUsd,
    paused: data.enabled && data.pausedReason === AutoTopUpPausedReason.SPEND_LIMIT_REACHED,
    resumesAt: data.resumesAt ?? null,
    minimumAmountUsd,
    // The backend's own rule when it does not say: a fifth of the amount floor, rounded up.
    minimumThresholdUsd: data.minimumThresholdUsd ?? Math.ceil(minimumAmountUsd / 5),
    switchedOff: isSwitchedOffReason(data.disabledReason) ? data.disabledReason : null,
    paymentMethodSetupUrl: data.paymentMethodSetupUrl ?? null,
  };
}

/**
 * How far the last 30 days' auto top-ups have gone into the limit, 0–100, and
 * whether they reached it — the bar under the limit on the billing page and in
 * the modal. `null` without a limit: there is nothing to fill.
 */
export function spendLimitUsage(
  spentUsd: number,
  limitUsd: number | null,
): { percent: number; reached: boolean } | null {
  if (limitUsd == null || limitUsd <= 0) return null;
  const reached = spentUsd >= limitUsd;
  // A limit lowered under what was already spent still draws a full bar, never past it.
  return { percent: reached ? 100 : (spentUsd / limitUsd) * 100, reached };
}
