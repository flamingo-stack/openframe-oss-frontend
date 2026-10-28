'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { cancellationTerms_query$key } from '@/__generated__/cancellationTerms_query.graphql';
import { LoadingLine } from '@/app/components/shared/loading-line';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { formatDate } from '@/lib/format-date';
import { hasSubscriptionPackage } from '../shared/subscription-package';
import { PACKAGE_CANCELLATION_TERMS, PAYG_CANCELLATION_TERMS } from './cancellation-copy';

/**
 * Live-from-Stripe preview of the effective cancellation date, which is the
 * right source: the subscription's own `cancellationEffectiveAt` is null while
 * it is still ACTIVE. The paid period's end stands in when Stripe has no
 * preview to give. Whether the subscription carries a package decides whether
 * there is a date to state at all.
 */
const cancellationTermsFragment = graphql`
  fragment cancellationTerms_query on Query {
    subscriptionCancellationPreview
    subscription {
      id
      currentPeriodEnd
      ...subscriptionPackage_subscription
    }
  }
`;

/** The terms run to two lines of the dialog's width (an estimate from the copy's length, not measured). */
const TERMS_LINES = 2;

/**
 * When access ends and what keeps working until then. `query` is null only while the dialog's query is on its way
 * (drawn in a loading scope): the date and the terms are bars, because which terms apply is what the query says.
 */
export function CancellationTerms({ query }: { query: cancellationTerms_query$key | null }) {
  const data = useFragment(cancellationTermsFragment, query);
  const loading = useLoadingScope() || data == null;
  const withPackage = data?.subscription ? hasSubscriptionPackage(data.subscription) : true;

  if (!loading && !withPackage) {
    return <p className="text-ods-text-primary text-h4">{PAYG_CANCELLATION_TERMS}</p>;
  }

  return (
    <>
      <div className="flex gap-[var(--spacing-system-xs)] text-ods-text-primary text-h4">
        <span>Your subscription will remain active until:</span>
        {loading ? (
          <LoadingLine as="span" type="h4" className="w-20" />
        ) : (
          <span className="text-ods-warning">
            {formatDate(data.subscriptionCancellationPreview ?? data.subscription?.currentPeriodEnd ?? null)}
          </span>
        )}
      </div>
      <LoadingParagraph loading={loading} text={PACKAGE_CANCELLATION_TERMS} tone="primary" lines={TERMS_LINES} />
    </>
  );
}
