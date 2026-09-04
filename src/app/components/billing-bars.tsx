'use client';

import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  PlusCircleIcon,
  XmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AnnouncementBarView, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { billingBarsQuery as BillingBarsQueryType } from '@/__generated__/billingBarsQuery.graphql';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { type AiSpendTone, aiSpendPercent, aiSpendTone } from '@/lib/ai-spend-tone';

/**
 * Everything the app-wide billing banners are decided from, in ONE query.
 *
 * Its own query rather than more fields on `subscriptionGuardQuery`, which runs
 * beside it: `usage` is non-null, so an error resolving it would null the whole
 * `subscription` payload — and that query's answer decides whether the app is
 * locked. A failure here costs a banner; a failure there locks everyone out.
 * One extra request per shell mount is the cheaper side of that trade.
 */
const billingBarsQuery = graphql`
  query billingBarsQuery {
    subscription {
      id
      status
      startDate
      trialExpirationDate
      aiSpendCapUsd
      usage {
        aiSpendUsd
      }
    }
  }
`;

/**
 * Stated only when the percentage cannot be computed — a cap of 0, where every
 * spend is already 100% of it and no ratio exists to round.
 */
const AI_CAP_WARNING_FALLBACK_PERCENT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

interface AiSpendLimitBarProps {
  /** `warning` = close to the cap, `error` = reached it. Never `default` here. */
  tone: Exclude<AiSpendTone, 'default'>;
  /** How far into the cap the spend is, when it can be stated. */
  percent: number | null;
  onExpand: () => void;
}

/**
 * App-wide bar for a subscription running into its own AI spending cap.
 *
 * Takes the layout's single `topBar` slot ahead of every other bar (see
 * `AppLayout`): agents that are about to stop answering outrank a trial that
 * still has days on it and a setup tour that can wait, and the state is
 * invisible from every page except Billing & Usage — which is where the bar
 * sends you.
 *
 * Colour follows the Paid AI Tokens card, from the same rule
 * (`lib/ai-spend-tone.ts`), so the bar and the card can never disagree about
 * whether AI is approaching its limit or past it.
 *
 * Height, type scale and CTA size are `AnnouncementBarView`'s and are NOT
 * negotiable from a mockup — that component carries an explicit freeze notice
 * saying so. Only the surface colours and the slots below are ours.
 */
export function AiSpendLimitBar({ tone, percent, onExpand }: AiSpendLimitBarProps) {
  const reached = tone === 'error';

  return (
    <AnnouncementBarView
      className={`app-top-bar shrink-0 text-ods-text-on-accent md:min-h-12 ${
        reached ? 'bg-ods-error' : 'bg-ods-warning'
      }`}
      contentClassName="cursor-pointer md:cursor-default"
      onContentClick={onExpand}
      startAdornment={<AlertTriangleIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title={
        reached
          ? 'AI spending limit reached. Agents are paused until the next cycle. Raise the limit in Billing & Usage to resume now.'
          : // The figure is computed, not the mockup's fixed "80%": the threshold
            // this bar appears at is the card's, and quoting a number the tenant
            // is not actually at would be the one wrong thing a warning can say.
            `AI usage is at ${percent ?? AI_CAP_WARNING_FALLBACK_PERCENT}% of your monthly limit. Agents pause at 100%. Adjust the limit in Billing & Usage.`
      }
      actionBlock={
        <Button variant="outline" size="small" leftIcon={<PlusCircleIcon className="size-4" />} onClick={onExpand}>
          Expand AI Limit
        </Button>
      }
    />
  );
}

interface TrialEndingBarProps {
  /** Whole days left, rounded up — 0 means it lapses today. */
  daysLeft: number;
  onActivate: () => void;
  onDismiss: () => void;
}

/**
 * The free trial is past its halfway point.
 *
 * The one bar here that can be dismissed, because it is the one that is not
 * about something breaking: the trial still works, and the tenant has days to
 * act. The AI bars above have no dismiss for the opposite reason — the agents
 * are already stopping, and hiding that would only make the silence
 * unexplained.
 */
export function TrialEndingBar({ daysLeft, onActivate, onDismiss }: TrialEndingBarProps) {
  return (
    <AnnouncementBarView
      className="app-top-bar shrink-0 bg-ods-warning text-ods-text-on-accent md:min-h-12"
      contentClassName="cursor-pointer md:cursor-default"
      onContentClick={onActivate}
      startAdornment={<CalendarDaysIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title={`${daysLeft === 1 ? '1 day' : `${daysLeft} days`} left on your free trial. Activate your subscription to keep your agents working.`}
      actionBlock={
        <Button variant="outline" size="small" onClick={onActivate}>
          Activate Subscription
        </Button>
      }
      endAdornment={
        <button
          type="button"
          aria-label="Dismiss trial reminder"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-ods-text-on-accent/70 transition-colors hover:text-ods-text-on-accent"
        >
          <XmarkIcon className="size-4" />
        </button>
      }
    />
  );
}

/** What the bars need to know, once the query has answered. */
export interface BillingBarsState {
  ai: { tone: AiSpendTone; percent: number | null };
  /**
   * The trial, once it is past halfway. `null` at every other moment — not on a
   * trial, no dates to place the midpoint with, or still in the first half.
   */
  trial: {
    daysLeft: number;
    /**
     * Identifies THIS trial period. The dismissal is stored against it, so
     * closing today's banner cannot silence a trial that starts later.
     */
    token: string;
  } | null;
}

const NO_BARS: BillingBarsState = { ai: { tone: 'default', percent: null }, trial: null };

/**
 * The trial, if it is past its midpoint.
 *
 * Both dates are required and neither is guessed: without a start there is no
 * midpoint to be past, and the honest answer is to say nothing rather than to
 * assume a trial length. A trial whose end has already gone by is not this
 * bar's business either — the workspace is locked by then and the paywall is
 * the whole screen.
 */
function resolveTrial(
  status: string | null | undefined,
  startDate: string | null | undefined,
  trialEnd: string | null | undefined,
  subscriptionId: string | null | undefined,
): BillingBarsState['trial'] {
  if (status !== SubscriptionStatus.TRIAL || !startDate || !trialEnd) return null;

  const start = new Date(startDate).getTime();
  const end = new Date(trialEnd).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (now < start + (end - start) / 2) return null;
  if (now >= end) return null;

  return {
    daysLeft: Math.max(1, Math.ceil((end - now) / DAY_MS)),
    token: `${subscriptionId ?? 'unknown'}:${trialEnd}`,
  };
}

/**
 * Runs the query and reports both bar states up. Its own component because
 * `useLazyLoadQuery` suspends and a hook cannot be called conditionally — the
 * same shape as `SubscriptionStatusHydrator`, and mounted inside a `Suspense`
 * whose fallback is the nothing this renders.
 */
export function BillingBarsHydrator({ onResolved }: { onResolved: (state: BillingBarsState) => void }) {
  const data = useLazyLoadQuery<BillingBarsQueryType>(billingBarsQuery, {}, { fetchPolicy: 'store-and-network' });

  const subscription = data.subscription;
  const capUsd = subscription?.aiSpendCapUsd ?? null;
  const spendUsd = subscription?.usage?.aiSpendUsd ?? 0;
  const tone = aiSpendTone(spendUsd, capUsd);
  const percent = aiSpendPercent(spendUsd, capUsd);
  const trial = resolveTrial(
    subscription?.status,
    subscription?.startDate,
    subscription?.trialExpirationDate,
    subscription?.id,
  );

  // Primitives in the deps, so the effect re-fires on a real change rather than
  // on every fresh Relay snapshot object.
  const trialDaysLeft = trial?.daysLeft ?? null;
  const trialToken = trial?.token ?? null;
  useEffect(() => {
    onResolved({
      ai: { tone, percent },
      trial: trialDaysLeft != null && trialToken != null ? { daysLeft: trialDaysLeft, token: trialToken } : null,
    });
  }, [tone, percent, trialDaysLeft, trialToken, onResolved]);

  return null;
}

export { NO_BARS };
