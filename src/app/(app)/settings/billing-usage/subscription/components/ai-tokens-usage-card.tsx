'use client';

import { GiftIcon, QuestionCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { AI_LIMIT_EXPLANATION, AiSpendLimitFields } from '../../components/ai-spend-limit-fields';
import type { AiSpendLimit } from '../../hooks/use-ai-spend-limit';
import { freeTokensForPlan } from '../../lib/ai-free-tokens';
import { formatCompactCount } from '../../lib/format';
import type { DevicePlanMode } from '../types/subscription.types';
import { ModelTokenRates } from './model-token-rates';

interface AiTokensUsageCardProps {
  /** The catalog has not answered yet — see the component docblock. */
  loading: boolean;
  /**
   * How the devices beside this card will be paid for. The grant follows it, so
   * switching Monthly/Annual on the left restates the free tokens here.
   * `null` until the picker has reported a selection.
   */
  deviceMode: DevicePlanMode | null;
  /**
   * The spending limit as the user is editing it, owned by the paywall. Held
   * there because the page's one button is what saves it — see below.
   */
  limit: AiSpendLimit;
}

/**
 * AI on the paywall: what it costs, what it gives away, and the ceiling the user
 * may put on it.
 *
 * It is NOT a plan picker. AI is metered only — there is no package to prepay
 * and nothing here contributes to the checkout total (the paywall enters AI as
 * pay-as-you-go on its own).
 *
 * Nor does this card SAVE anything. The limit is part of the form the page's
 * "Proceed to Payment" submits, so it is written there, once, with the rest of
 * the choice (see `SubscriptionSubmitButton`). Writing it per click — which this
 * did — meant that merely unticking the box to look at the options changed the
 * subscription, with no way back but re-entering the old figure.
 *
 * The controls are the same ones the billing page's AI Tokens Limit modal shows
 * (`AiSpendLimitFields`); only the moment of writing differs.
 */
export function AiTokensUsageCard({ loading, deviceMode, limit }: AiTokensUsageCardProps) {
  // A prepaid year is a commitment; pay-as-you-go is not, and it grants less.
  const freeTokens = deviceMode == null ? null : freeTokensForPlan(deviceMode === 'ANNUAL');

  return (
    <Card
      className="relative flex flex-1 flex-col gap-6 p-6 bg-ods-bg border-ods-border"
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-h2 text-ods-text-primary">AI Tokens Usage</h2>
          <p className="text-h4 text-ods-text-primary">
            Fae and Mingo are billed for what they actually use. No prepayment needed.
          </p>
        </div>
        {/* Same popover the plan picker used to carry, kept on the card the rates
            belong to: per-model token rates are what the figures below are in. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Per-model token rates"
              className="shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
            >
              <QuestionCircleIcon className="size-6" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
            <ModelTokenRates />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* The grant depends on the plan next door, so it holds its line until
          that choice exists rather than letting a sentence appear under the
          user's cursor. */}
      <div className="flex items-start gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]">
        <GiftIcon className="size-6 shrink-0 text-ods-accent" />
        {freeTokens == null ? (
          <Skeleton className="h-5 w-full max-w-[22rem]" />
        ) : (
          <p className="text-h4 text-ods-text-primary">
            <span className="text-h3 text-ods-accent">{formatCompactCount(freeTokens)}</span> free tokens every month.
            Usage beyond that is billed at the end of each cycle.
          </p>
        )}
      </div>

      {/* No `onCommit`: nothing is written until the page is submitted. */}
      <AiSpendLimitFields limit={limit} disabled={loading} />

      {limit.enabled && <p className="text-h6 text-ods-text-primary">{AI_LIMIT_EXPLANATION}</p>}
    </Card>
  );
}
