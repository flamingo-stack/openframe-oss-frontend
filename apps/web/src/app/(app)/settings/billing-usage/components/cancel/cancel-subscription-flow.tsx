'use client';

import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { cancelSubscriptionFlow_subscription$key } from '@/__generated__/cancelSubscriptionFlow_subscription.graphql';
import { hasSubscriptionPackage } from '../shared/subscription-package';
import { CancelOfferModal } from './cancel-offer-modal';
import { type CancelReason, CancelSubscriptionModal } from './cancel-subscription-modal';
import { SubscriptionCancelledModal } from './subscription-cancelled-modal';
import { useCancelSubscription } from './use-cancel-subscription';

/**
 * What the closing dialog states. The date lands with the refetch after the cancel (an em dash until then). The
 * terms follow the package, not the status, which is still ACTIVE until that refetch.
 */
const cancelSubscriptionFlowFragment = graphql`
  fragment cancelSubscriptionFlow_subscription on SubscriptionDetail {
    cancellationEffectiveAt
    ...subscriptionPackage_subscription
  }
`;

type Step = 'reason' | 'offer' | 'cancelled';

interface CancelSubscriptionFlowProps {
  subscription: cancelSubscriptionFlow_subscription$key;
  /** The user left the flow, at any step — including after the cancellation went through. */
  onClose: () => void;
  /** "Find a Plan that Fits" — the offer hands off to the plan change. */
  onChangePlan: () => void;
  /** The cancellation landed; the page refetches for its pending-cancellation state. */
  onCancelled: () => void;
}

/**
 * Cancelling, in three dialogs: why, an offer to stay, and when access ends.
 * One owner of the step and of what was said in the first dialog, because the
 * second dialog sends it.
 *
 * Mounted by the page only while the flow is open, so every start begins at
 * the first dialog with nothing chosen.
 */
export function CancelSubscriptionFlow({
  subscription,
  onClose,
  onChangePlan,
  onCancelled,
}: CancelSubscriptionFlowProps) {
  const data = useFragment(cancelSubscriptionFlowFragment, subscription);
  const cancelSubscription = useCancelSubscription();
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState('');

  return (
    <>
      <CancelSubscriptionModal
        isOpen={step === 'reason'}
        onClose={onClose}
        onConfirm={(chosenReason, chosenComment) => {
          setReason(chosenReason);
          setComment(chosenComment);
          setStep('offer');
        }}
      />

      <CancelOfferModal
        isOpen={step === 'offer'}
        reason={reason}
        isPending={cancelSubscription.isPending}
        onClose={onClose}
        onCtaClick={onChangePlan}
        onConfirm={() => {
          cancelSubscription.mutate({
            reason: reason ?? undefined,
            description: comment || undefined,
            onSuccess: () => {
              setStep('cancelled');
              onCancelled();
            },
          });
        }}
      />

      <SubscriptionCancelledModal
        isOpen={step === 'cancelled'}
        endDate={data.cancellationEffectiveAt ?? null}
        withPackage={hasSubscriptionPackage(data)}
        onClose={onClose}
      />
    </>
  );
}
