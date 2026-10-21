'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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

/** `query` is null only while the dialog's query is on its way (drawn in a loading scope): the sentence is fixed copy
 * and stays real, the date is a bar. */
export function CancellationEffectiveDate({ query }: { query: cancellationEffectiveDate_query$key | null }) {
  const data = useFragment(cancellationEffectiveDateFragment, query);
  const loading = useLoadingScope() || data == null;

  return (
    <div className="flex gap-[var(--spacing-system-xs)] text-ods-text-primary text-h4">
      <span>Your subscription will remain active until:</span>
      {loading ? (
        <TextLineSkeleton as="span" type="h4" className="w-20" />
      ) : (
        <span className="text-ods-warning">
          {formatDate(data.subscriptionCancellationPreview ?? data.subscription?.currentPeriodEnd ?? null)}
        </span>
      )}
    </div>
  );
}
