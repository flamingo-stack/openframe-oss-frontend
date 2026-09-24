'use client';

import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  TagPercentIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { useBillingPageActions_subscription$key } from '@/__generated__/useBillingPageActions_subscription.graphql';
import { resolveSubscriptionStatus, SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { openBillingInBrowser } from '@/lib/billing-visibility';
import { openExternalTab } from '../shared/stripe-window';
import { useBillingPortalSession } from './use-billing-portal-session';
import { useResumeSubscription } from './use-resume-subscription';

/** What the header decides on: the state the workspace is in, and the invoice "Pay Overage" opens. */
const useBillingPageActionsFragment = graphql`
  fragment useBillingPageActions_subscription on SubscriptionDetail {
    status
    # The newest outstanding invoice is what "Pay Overage" opens.
    pendingInvoices {
      id
      createdAt
      hostedInvoiceUrl
    }
  }
`;

export interface BillingPageActions {
  /** The header's buttons; rightmost is the accent one. */
  actions: PageActionButton[];
  menuActions: ActionsMenuGroup[];
}

interface BillingPageActionsArgs {
  /** `null` when there is no subscription record: nothing to act on. */
  subscription: useBillingPageActions_subscription$key | null;
  /**
   * The desktop build: every figure renders and nothing changes one, so the
   * header's single action leaves for the web app (see `billing-visibility.ts`).
   */
  readOnly: boolean;
  onChangePlan: () => void;
  onActivate: () => void;
  /**
   * Opens Manage AI Balance; `null` when there is no balance to manage — no AI
   * product, a trial, the read-only build. The page decides, because it owns
   * the modal's state (the URL).
   */
  onManageAiBalance: (() => void) | null;
  onCancel: () => void;
  /** A renewal answers with a bare Boolean, so the page refetches for its new state. */
  onRenewed: () => void;
}

/**
 * The page header's actions, decided from the subscription's state.
 *
 * Two slots and a menu. The accent slot is the state's own thing to do, when
 * there is one: clear a scheduled cancellation, settle an overdue invoice, or
 * turn a trial into a subscription. The quieter slot is the balance — the one
 * of the two a paused assistant depends on, and what the app-wide balance bar
 * deep-links to. The plan change lives in the menu whatever the plan, so that
 * the quieter slot stays the balance.
 */
export function useBillingPageActions({
  subscription,
  readOnly,
  onChangePlan,
  onActivate,
  onManageAiBalance,
  onCancel,
  onRenewed,
}: BillingPageActionsArgs): BillingPageActions {
  const data = useFragment(useBillingPageActionsFragment, subscription);
  const resumeSubscription = useResumeSubscription();
  const billingPortal = useBillingPortalSession();
  const cancelSubscriptionEnabled = useFeatureFlag('cancel-subscription');

  if (readOnly) {
    return {
      actions: [
        {
          label: 'Manage Billing',
          icon: <ExternalLinkIcon className="h-6 w-6" />,
          onClick: openBillingInBrowser,
          variant: 'accent',
        },
      ],
      menuActions: [],
    };
  }

  if (data == null) return { actions: [], menuActions: [] };

  const status = resolveSubscriptionStatus(data.status);
  const isTrial = status === SubscriptionStatus.TRIAL;
  const isPendingCancellation = status === SubscriptionStatus.PENDING_CANCELLATION;
  const isOverdue =
    status === SubscriptionStatus.PAST_DUE ||
    status === SubscriptionStatus.SUSPENDED ||
    status === SubscriptionStatus.CANCELED;

  // Nothing to update in place: these three states have no live paid
  // subscription, so the plan is STARTED, through Stripe Checkout — the
  // Activate Subscription modal, not the plan change. PAST_DUE and SUSPENDED
  // are deliberately NOT here — those subscriptions still exist.
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  /**
   * A scheduled cancellation drops the plan offer everywhere. The subscription
   * is already on its way out, so a change would be bought into something that
   * ends anyway; renewing is the move that makes the rest meaningful again.
   * Nor is there a plan to change before one has been bought: on a trial the
   * header's Activate Subscription is the whole offer.
   */
  const planOffered = !isPendingCancellation && !needsCheckout;

  // Stripe hosts the invoice; the newest outstanding one is the one to settle.
  const latestPendingInvoiceUrl =
    [...data.pendingInvoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      ?.hostedInvoiceUrl ?? null;

  const menuActions: ActionsMenuGroup[] = [
    {
      items: [
        ...(planOffered
          ? [
              {
                id: 'change-plan',
                label: 'Change Plan',
                icon: <TagPercentIcon className="h-6 w-6 text-ods-text-secondary" />,
                onClick: onChangePlan,
              },
            ]
          : []),
        {
          id: 'customer-portal',
          // Stripe mints the portal session per click, so this runs a mutation
          // and then navigates — there is no stable URL to hang a link on.
          label: 'Customer Portal',
          icon: <ExternalLinkIcon className="h-6 w-6 text-ods-text-secondary" />,
          onClick: () => billingPortal.mutate(),
          disabled: billingPortal.isPending,
        },
        ...(status === SubscriptionStatus.ACTIVE && cancelSubscriptionEnabled
          ? [
              {
                id: 'cancel-subscription',
                label: 'Cancel Subscription',
                icon: <AlertTriangleIcon className="h-6 w-6 text-ods-error" />,
                onClick: onCancel,
              },
            ]
          : []),
      ],
    },
  ];

  /**
   * The state the workspace is in, when that state has its own thing to do. A
   * live plan is changed in the Upgrade Plan modal, and a trial is turned into
   * a subscription in the Activate Subscription modal — the paywall's form,
   * which buys the whole plan (devices, the AI product and the first top-up)
   * on one checkout.
   */
  const statusAction: PageActionButton | null = isPendingCancellation
    ? {
        label: 'Renew Subscription',
        // Still inside the paid period → clear the scheduled cancellation in
        // place via resumeSubscription (no checkout needed), then refetch.
        onClick: () => resumeSubscription.mutate({ onSuccess: onRenewed }),
        variant: 'accent',
        loading: resumeSubscription.isPending,
        disabled: resumeSubscription.isPending,
      }
    : isOverdue
      ? {
          label: 'Pay Overage',
          onClick: () => {
            if (latestPendingInvoiceUrl) {
              openExternalTab(latestPendingInvoiceUrl);
            } else {
              onChangePlan();
            }
          },
          variant: 'accent',
        }
      : isTrial
        ? { label: 'Activate Subscription', onClick: onActivate, variant: 'accent' }
        : null;

  const secondaryAction: PageActionButton | null = onManageAiBalance
    ? { label: 'Manage AI Balance', onClick: onManageAiBalance, variant: 'outline' }
    : null;

  return {
    actions: [...(secondaryAction ? [secondaryAction] : []), ...(statusAction ? [statusAction] : [])],
    menuActions,
  };
}
