'use client';

import { graphql, readInlineData, useLazyLoadQuery } from 'react-relay';
import type { useBillingNotices_notice$key } from '@/__generated__/useBillingNotices_notice.graphql';
import type { useBillingNoticesQuery as UseBillingNoticesQueryType } from '@/__generated__/useBillingNoticesQuery.graphql';
import { AutoTopUpDisabledReason, BillingNoticeSeverity, BillingNoticeType } from '@/generated/schema-enums';
import type { Instant } from '@/lib/graphql-scalars';

/**
 * The billing notices that hold now, less the dismissed ones — the in-product
 * side of the billing emails, with the same dates and amounts. Empty while the
 * backend's notifications flag is off, so a surface that draws nothing for an
 * empty list looks as it did before the notices existed.
 *
 * Its own query rather than a field on the surfaces' queries: the list is read
 * from another service, and its failure must cost a notice, never the lock
 * screen or the bars it sits beside.
 */
const useBillingNoticesQuery = graphql`
  query useBillingNoticesQuery {
    billingNotices {
      ...useBillingNotices_notice
    }
  }
`;

/** No `currency`: `formatCurrency` prints USD, as every other figure in billing does. */
const billingNoticeFragment = graphql`
  fragment useBillingNotices_notice on BillingNotice @inline {
    type
    eventKey
    severity
    amountDue
    suspensionDate
    deletionDate
    trialEndDate
    reason
  }
`;

/** One notice. Fields a type does not use are `null`. */
export interface BillingNotice {
  type: BillingNoticeType;
  /** The event the notice is about; passed back to dismiss it. */
  eventKey: string;
  severity: BillingNoticeSeverity;
  /** PAYMENT_OVERDUE, in dollars. */
  amountDue: number | null;
  /** PAYMENT_OVERDUE. */
  suspensionDate: Instant | null;
  /** ACCOUNT_SUSPENDED. */
  deletionDate: Instant | null;
  /** TRIAL_ENDING. */
  trialEndDate: Instant | null;
  /** AUTO_TOP_UP_DISABLED; `null` for a reason this build does not know. */
  reason: AutoTopUpDisabledReason | null;
}

function isKnown<T extends string>(values: Record<string, T>, value: string | null | undefined): value is T {
  return value != null && Object.hasOwn(values, value);
}

/** A notice of a type this build does not know draws nothing, so it is left out here. */
function toBillingNotice(ref: useBillingNotices_notice$key): BillingNotice | null {
  const notice = readInlineData(billingNoticeFragment, ref);
  if (!isKnown(BillingNoticeType, notice.type)) return null;
  return {
    type: notice.type,
    eventKey: notice.eventKey,
    severity: isKnown(BillingNoticeSeverity, notice.severity) ? notice.severity : BillingNoticeSeverity.WARNING,
    amountDue: notice.amountDue ?? null,
    suspensionDate: notice.suspensionDate ?? null,
    deletionDate: notice.deletionDate ?? null,
    trialEndDate: notice.trialEndDate ?? null,
    reason: isKnown(AutoTopUpDisabledReason, notice.reason) ? notice.reason : null,
  };
}

/**
 * Suspends. Readable in every subscription state, so it skips the subscription
 * gate: the overdue and suspended lock screens are where two of the notices go.
 */
export function useBillingNotices(): BillingNotice[] {
  const data = useLazyLoadQuery<UseBillingNoticesQueryType>(
    useBillingNoticesQuery,
    {},
    { fetchPolicy: 'store-and-network', networkCacheConfig: { metadata: { skipSubscriptionGate: true } } },
  );
  return data.billingNotices.map(toBillingNotice).filter(notice => notice != null);
}

/** The notice of this type, if it holds. The backend sends at most one per type. */
export function findNotice(notices: readonly BillingNotice[], type: BillingNoticeType): BillingNotice | null {
  return notices.find(notice => notice.type === type) ?? null;
}
