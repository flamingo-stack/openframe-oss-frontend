'use client';

import { graphql, useFragment } from 'react-relay';
import type { cancellationEffectiveDate_query$key } from '@/__generated__/cancellationEffectiveDate_query.graphql';
import { formatDate } from '@/lib/format-date';

/**
 * Live-from-Stripe preview of the effective cancellation date, which is the
 * right source: the subscription's own `cancellationEffectiveAt` is null while
 * it is still ACTIVE. The paid period's end stands in when Stripe has no
 * preview to give.
 */
const cancellationEffectiveDateFragment = graphql`
  fragment cancellationEffectiveDate_query on Query {
    subscriptionCancellationPreview
    subscription {
      id
      currentPeriodEnd
    }
  }
`;

export function CancellationEffectiveDate({ query }: { query: cancellationEffectiveDate_query$key }) {
  const data = useFragment(cancellationEffectiveDateFragment, query);
  const date = data.subscriptionCancellationPreview ?? data.subscription?.currentPeriodEnd ?? null;

  return (
    <div className="flex gap-[var(--spacing-system-xs)] text-ods-text-primary text-h4">
      <span>Your subscription will remain active until:</span>
      <span className="text-ods-warning">{formatDate(date)}</span>
    </div>
  );
}
