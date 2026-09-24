'use client';

import { GiftIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Card, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatCompactCount } from '@/lib/format-number';
import { AI_BALANCE_EXPLANATION, AiTopUpFields } from '../../components/ai-top-up-fields';
import { AutoTopUpCheckbox } from '../../components/auto-top-up-checkbox';
import type { AiTopUp } from '../../hooks/use-ai-top-up';
import { freeTokensForPlan } from '../../lib/ai-free-tokens';
import type { DevicePlanMode } from '../types/subscription.types';
import { ModelTokenRatesPopover } from './model-token-rates';

interface AiTokenBalanceCardProps {
  /** The catalog has not answered yet — see the component docblock. */
  loading: boolean;
  /**
   * How the devices beside this card will be paid for. The grant follows it, so
   * switching Monthly/Annual on the left restates the free tokens here.
   * `null` until the picker has reported a selection.
   */
  deviceMode: DevicePlanMode | null;
  /**
   * The first top-up as the user is choosing it, owned by the paywall. Held
   * there because the page's one button is what sends it — see below.
   */
  topUp: AiTopUp;
}

/**
 * AI on the paywall: the balance the assistants run on, what the plan gives
 * away, and the first top-up.
 *
 * It is NOT a plan picker. AI has no package to prepay; what is chosen here is
 * a balance, and it rides on the checkout (`CheckoutInput.tokenAmountUsd`) to be
 * charged on the same invoice as the devices. So the card writes nothing of its
 * own — the page's "Proceed to Payment" submits the whole form at once.
 *
 * "Enable Auto Top-up" sits under the amounts as the mockup has it, locked for
 * the same reason it is locked everywhere (see `auto-top-up.ts`).
 */
export function AiTokenBalanceCard({ loading, deviceMode, topUp }: AiTokenBalanceCardProps) {
  // A prepaid year is a commitment; pay-as-you-go is not, and it grants less.
  const freeTokens = deviceMode == null ? null : freeTokensForPlan(deviceMode === 'ANNUAL');

  return (
    <Card
      className="relative flex flex-1 flex-col gap-6 border-ods-border bg-ods-bg p-6"
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-ods-text-primary text-h2">AI Token Balance</h2>
          <p className="text-ods-text-primary text-h4">{AI_BALANCE_EXPLANATION}</p>
        </div>
        {/* Per-model token rates are what the figures below are counted in. */}
        <ModelTokenRatesPopover />
      </div>

      {/* The grant depends on the plan next door, so it holds its line until
          that choice exists rather than letting a sentence appear under the
          user's cursor. */}
      <div className="flex items-start gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]">
        <GiftIcon className="size-6 shrink-0 text-ods-accent" />
        {freeTokens == null ? (
          <Skeleton className="h-5 w-full max-w-[22rem]" />
        ) : (
          <p className="text-ods-text-primary text-h4">
            <span className="text-ods-accent text-h3">{formatCompactCount(freeTokens)}</span> free tokens every month.
            Anything beyond that draws from your balance.
          </p>
        )}
      </div>

      <AiTopUpFields topUp={topUp} label="Top up your balance" disabled={loading} />

      <AutoTopUpCheckbox disabled={loading} />
    </Card>
  );
}
