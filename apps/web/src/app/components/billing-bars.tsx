'use client';

import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  XmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AnnouncementBarView, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { billingBarsQuery as BillingBarsQueryType } from '@/__generated__/billingBarsQuery.graphql';
import { AutoTopUpDisabledReason, BillingNoticeType, SubscriptionStatus } from '@/generated/schema-enums';
import { type AiBalanceTone, aiBalanceTone } from '@/lib/ai-balance-tone';
import { formatDate } from '@/lib/format-date';
import type { Instant } from '@/lib/graphql-scalars';
import { findNotice, useBillingNotices } from './billing-notices/use-billing-notices';

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
      # Identifies the record, so a fresher answer for it from another query reaches the bar.
      id
      status
      usage {
        aiTokensFree
        aiTokensFreeUsed
        purchasedTokensRemaining
      }
    }
  }
`;

interface AiBalanceBarProps {
  /** `warning` = running low, `error` = empty. Never `default` here. */
  tone: Exclude<AiBalanceTone, 'default'>;
  onManage: () => void;
}

/**
 * App-wide bar for a subscription running out of AI tokens.
 *
 * Takes the layout's single `topBar` slot ahead of every other bar (see
 * `AppLayout`): agents that are about to stop answering outrank a trial that
 * still has days on it and a setup tour that can wait, and the state is
 * invisible from every page except Billing & Usage — which is where the bar
 * sends you, with the top-up dialog already open.
 *
 * Not dismissible, by product decision: the agents are stopping (or have
 * stopped), and hiding that would only make the silence unexplained. It goes
 * away when the balance does — a top-up is the one thing that clears it.
 *
 * Colour follows the Paid AI Tokens card, from the same rule
 * (`lib/ai-balance-tone.ts`), so the bar and the card can never disagree about
 * whether AI is running low or has run out.
 *
 * Height, type scale and CTA size are `AnnouncementBarView`'s and are NOT
 * negotiable from a mockup — that component carries an explicit freeze notice
 * saying so. Only the surface colours and the slots below are ours.
 */
export function AiBalanceBar({ tone, onManage }: AiBalanceBarProps) {
  const empty = tone === 'error';

  return (
    <AnnouncementBarView
      className={`app-top-bar shrink-0 text-ods-text-on-accent md:min-h-12 ${empty ? 'bg-ods-error' : 'bg-ods-warning'}`}
      contentClassName="cursor-pointer md:cursor-default"
      onContentClick={onManage}
      startAdornment={<AlertTriangleIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title={
        empty
          ? 'Your AI balance is empty. AI agents are paused. Top up in Billing & Usage to continue.'
          : 'Your AI balance is running low. AI agents pause at zero. Top up in Billing & Usage to continue.'
      }
      actionBlock={
        <Button variant="outline" size="small" onClick={onManage}>
          Manage AI Balance
        </Button>
      }
    />
  );
}

interface TrialEndingBarProps {
  /** When the trial ends: the notice's `trialEndDate`, the date the trial email states. */
  trialEndDate: Instant;
  onActivate: () => void;
  onDismiss: () => void;
}

/**
 * The free trial ends within seven days — the backend's TRIAL_ENDING notice,
 * beside the email it sends for the same trial.
 *
 * Dismissible, because it is not about something breaking: the trial still
 * works, and the tenant has days to act. The dismissal is the workspace's (see
 * `useDismissBillingNotice`), so it holds for every admin in every browser, and
 * the next trial end shows again. The AI bar above has no dismiss for the
 * opposite reason — the agents are already stopping, and hiding that would only
 * make the silence unexplained.
 */
export function TrialEndingBar({ trialEndDate, onActivate, onDismiss }: TrialEndingBarProps) {
  return (
    <AnnouncementBarView
      className="app-top-bar shrink-0 bg-ods-warning text-ods-text-on-accent md:min-h-12"
      contentClassName="cursor-pointer md:cursor-default"
      onContentClick={onActivate}
      startAdornment={<CalendarDaysIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title={`Your free trial ends on ${formatDate(trialEndDate)}. Activate your subscription to keep your agents working.`}
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

/** Why the system switched automatic top-up off, as the bar says it. */
const AUTO_TOP_UP_DISABLED_COPY: Partial<Record<AutoTopUpDisabledReason, string>> = {
  [AutoTopUpDisabledReason.PAYMENT_FAILED]:
    'Automatic top-up is off: the last automatic charge was declined. Turn it back on in Billing & Usage.',
  [AutoTopUpDisabledReason.AUTHENTICATION_ABANDONED]:
    'Automatic top-up is off: your bank asked to confirm the last automatic charge and nobody did. Turn it back on in Billing & Usage.',
};

const AUTO_TOP_UP_DISABLED_FALLBACK = 'Automatic top-up is off. Turn it back on in Billing & Usage.';

interface AutoTopUpDisabledBarProps {
  reason: AutoTopUpDisabledReason | null;
  onManage: () => void;
  onDismiss: () => void;
}

/**
 * The system switched automatic top-up off over a card payment — the backend's
 * AUTO_TOP_UP_DISABLED notice, held for seven days. Nothing else says so outside
 * Billing & Usage, and the balance stops refilling itself from that moment.
 *
 * Dismissible like the trial bar, for the workspace: the balance still works,
 * and the AI bar takes over if it runs low.
 */
export function AutoTopUpDisabledBar({ reason, onManage, onDismiss }: AutoTopUpDisabledBarProps) {
  return (
    <AnnouncementBarView
      className="app-top-bar shrink-0 bg-ods-warning text-ods-text-on-accent md:min-h-12"
      contentClassName="cursor-pointer md:cursor-default"
      onContentClick={onManage}
      startAdornment={<AlertTriangleIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title={(reason && AUTO_TOP_UP_DISABLED_COPY[reason]) ?? AUTO_TOP_UP_DISABLED_FALLBACK}
      actionBlock={
        <Button variant="outline" size="small" onClick={onManage}>
          Manage AI Balance
        </Button>
      }
      endAdornment={
        <button
          type="button"
          aria-label="Dismiss auto top-up notice"
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
  ai: { tone: AiBalanceTone };
}

const NO_BARS: BillingBarsState = { ai: { tone: 'default' } };

/**
 * Runs the query and reports the balance bar's state up. Its own component because
 * `useLazyLoadQuery` suspends and a hook cannot be called conditionally — the
 * same shape as `SubscriptionStatusHydrator`, and mounted inside a `Suspense`
 * whose fallback is the nothing this renders.
 */
export function BillingBarsHydrator({ onResolved }: { onResolved: (state: BillingBarsState) => void }) {
  const data = useLazyLoadQuery<BillingBarsQueryType>(billingBarsQuery, {}, { fetchPolicy: 'store-and-network' });

  const subscription = data.subscription;
  const usage = subscription?.usage;
  // A trial runs on its free grant alone and has no balance to top up, so the
  // balance bar has nothing to say about it: its own bar below is the one that
  // speaks for a trial, and the billing page states a spent grant on the card.
  // GraphQL `Long` arrives as a string or a number depending on its size.
  const tone: AiBalanceTone =
    subscription?.status === SubscriptionStatus.TRIAL
      ? 'default'
      : aiBalanceTone({
          freeTokens: Number(usage?.aiTokensFree ?? 0),
          freeUsed: Number(usage?.aiTokensFreeUsed ?? 0),
          purchasedRemaining: Number(usage?.purchasedTokensRemaining ?? 0),
        });

  // A primitive in the deps, so the effect re-fires on a real change rather than
  // on every fresh Relay snapshot object.
  useEffect(() => {
    onResolved({ ai: { tone } });
  }, [tone, onResolved]);

  return null;
}

/** The bars the backend's billing notices raise, with the event each one dismisses. */
export interface NoticeBarsState {
  /** TRIAL_ENDING. */
  trial: { trialEndDate: Instant; eventKey: string } | null;
  /** AUTO_TOP_UP_DISABLED. */
  autoTopUpDisabled: { reason: AutoTopUpDisabledReason | null; eventKey: string } | null;
}

const NO_NOTICE_BARS: NoticeBarsState = { trial: null, autoTopUpDisabled: null };

/**
 * Reads the billing notices and reports the bars they raise. Its own query and
 * its own boundary, beside the balance bar's: a notice failing to load costs that
 * notice, not the balance bar. The overdue and suspended notices are the lock
 * screens', not bars (see `BillingDeadlineNotice`).
 */
export function BillingNoticesHydrator({ onResolved }: { onResolved: (state: NoticeBarsState) => void }) {
  const notices = useBillingNotices();
  const trialNotice = findNotice(notices, BillingNoticeType.TRIAL_ENDING);
  const autoTopUpNotice = findNotice(notices, BillingNoticeType.AUTO_TOP_UP_DISABLED);

  // Primitives in the deps, as above.
  const trialEndDate = trialNotice?.trialEndDate ?? null;
  const trialEventKey = trialNotice?.eventKey ?? null;
  const autoTopUpEventKey = autoTopUpNotice?.eventKey ?? null;
  const autoTopUpReason = autoTopUpNotice?.reason ?? null;
  useEffect(() => {
    onResolved({
      trial: trialEndDate != null && trialEventKey != null ? { trialEndDate, eventKey: trialEventKey } : null,
      autoTopUpDisabled: autoTopUpEventKey != null ? { reason: autoTopUpReason, eventKey: autoTopUpEventKey } : null,
    });
  }, [trialEndDate, trialEventKey, autoTopUpEventKey, autoTopUpReason, onResolved]);

  return null;
}

export { NO_BARS, NO_NOTICE_BARS };
