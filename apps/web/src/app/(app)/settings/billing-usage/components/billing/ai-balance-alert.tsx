'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { aiBalanceAlert_subscription$key } from '@/__generated__/aiBalanceAlert_subscription.graphql';
import { formatDate } from '@/lib/format-date';
import { type AiAlert, aiBalanceState } from '../shared/ai-balance-state';

const aiBalanceAlertFragment = graphql`
  fragment aiBalanceAlert_subscription on SubscriptionDetail {
    # The reset date is the period's end, not a separate fact this can guess at.
    currentPeriodEnd
    ...aiBalanceState_subscription
  }
`;

/**
 * The block under the AI cards, by what it is about. Titles are the mockups'
 * verbatim; the reset date is appended when the period has one.
 */
const AI_ALERT_COPY: Record<NonNullable<AiAlert>, { title: string; description: string }> = {
  'trial-exhausted': {
    title: 'AI agents are paused.',
    description: 'Activate your subscription to keep Mingo and Fae running.',
  },
  low: {
    title: 'AI agents will pause soon.',
    description: 'Your AI balance is running low. Mingo and Fae stop responding when it hits zero.',
  },
  empty: {
    title: 'AI agents are paused. Your AI balance is empty.',
    description: 'Mingo and Fae stopped responding until you top up.',
  },
};

/**
 * The one sentence the page owes about AI right now: the balance is running
 * low, it is empty, or a trial has spent its grant. Only the icon carries the
 * colour — the card above already states the figure in full, and this block is
 * the sentence explaining it. The fix is in the header: Manage AI Balance, or
 * Activate Subscription on a trial.
 */
export function AiBalanceAlert({ subscription }: { subscription: aiBalanceAlert_subscription$key }) {
  const data = useFragment(aiBalanceAlertFragment, subscription);
  const ai = aiBalanceState(data);

  if (!ai.alert) return null;

  return (
    <div className="flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
      <AlertTriangleIcon
        className={cn('size-6 shrink-0', ai.alert === 'empty' ? 'text-ods-error' : 'text-ods-warning')}
      />
      <div className="flex min-w-0 flex-col">
        <p className="font-bold text-ods-text-primary text-h3">{AI_ALERT_COPY[ai.alert].title}</p>
        <p className="text-ods-text-secondary text-h4">
          {AI_ALERT_COPY[ai.alert].description}
          {/* A trial resets nothing: activation is what refills it. */}
          {ai.alert !== 'trial-exhausted' &&
            data.currentPeriodEnd &&
            ` Free tokens reset on ${formatDate(data.currentPeriodEnd)}.`}
        </p>
      </div>
    </div>
  );
}
