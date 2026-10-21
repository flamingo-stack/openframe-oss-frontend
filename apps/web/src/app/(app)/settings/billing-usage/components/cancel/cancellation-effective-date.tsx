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

const LINE_CLASS = 'flex gap-[var(--spacing-system-xs)] text-ods-text-primary text-h4';
const LINE_COPY = 'Your subscription will remain active until:';

/** The sentence is fixed copy and stays real; the date is a bar. */
function CancellationEffectiveDateSkeleton() {
  return (
    <div className={LINE_CLASS}>
      <span>{LINE_COPY}</span>
      <TextLineSkeleton as="span" type="h4" className="w-20" />
    </div>
  );
}

/** `query` is null only while the dialog's query is on its way (drawn in a loading scope). */
export function CancellationEffectiveDate({ query }: { query: cancellationEffectiveDate_query$key | null }) {
  const data = useFragment(cancellationEffectiveDateFragment, query);
  if (useLoadingScope() || data == null) return <CancellationEffectiveDateSkeleton />;
  const date = data.subscriptionCancellationPreview ?? data.subscription?.currentPeriodEnd ?? null;

  return (
    <div className={LINE_CLASS}>
      <span>{LINE_COPY}</span>
      <span className="text-ods-warning">{formatDate(date)}</span>
    </div>
  );
}
