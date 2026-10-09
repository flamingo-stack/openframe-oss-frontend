import { graphql, readInlineData } from 'react-relay';
import type { autoTopUpStatus_settings$key } from '@/__generated__/autoTopUpStatus_settings.graphql';
import { AutoTopUpDisabledReason } from '@/generated/schema-enums';

/**
 * The standing arrangement to buy more tokens before the bank empties, as every
 * surface reads it: the Paid AI Tokens card and its rates popover, the notice
 * under the cards, the Manage AI Balance modal — and the mutation that sets it,
 * so a field added for a reader is returned by the write by construction.
 *
 * `@inline` because the readers are fed through props and a mutation callback,
 * not through fragments of their own.
 */
const autoTopUpStatusFragment = graphql`
  fragment autoTopUpStatus_settings on AutoTopUpSettings @inline {
    enabled
    amountUsd
    disabledReason
    paymentMethodSetupUrl
  }
`;

export interface AutoTopUpStatus {
  /** The system may charge the card on file when the bank falls below the threshold. */
  enabled: boolean;
  /** What one automatic top-up charges, in whole dollars. */
  amountUsd: number | null;
  /**
   * The system switched it off: the card declined an automatic charge, which
   * is never retried. `false` when the customer switched it off, or it is on.
   */
  paymentFailed: boolean;
  /**
   * Where to add a card, set only when enabling was refused for want of one.
   * Nothing is saved then: the arrangement is armed once the customer comes
   * back from this page and saves again.
   */
  paymentMethodSetupUrl: string | null;
}

export function toAutoTopUpStatus(ref: autoTopUpStatus_settings$key): AutoTopUpStatus {
  const { enabled, amountUsd, disabledReason, paymentMethodSetupUrl } = readInlineData(autoTopUpStatusFragment, ref);
  return {
    enabled,
    amountUsd: amountUsd ?? null,
    paymentFailed: disabledReason === AutoTopUpDisabledReason.PAYMENT_FAILED,
    paymentMethodSetupUrl: paymentMethodSetupUrl ?? null,
  };
}

/**
 * The level the bank may fall to before the next pack is bought, in whole
 * dollars: a fifth of the pack, which is the rule the checkout's own switch
 * applies. Fires on the threshold rather than on zero — a refill that begins at
 * zero arrives after the thing it was meant to prevent, with AI already stopped.
 * At least $1, because the backend requires the amount to exceed it.
 */
export function autoTopUpThresholdUsd(amountUsd: number): number {
  return Math.max(1, Math.floor(amountUsd / 5));
}
