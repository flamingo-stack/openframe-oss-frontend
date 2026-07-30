'use client';

import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { subscriptionGuardQuery as SubscriptionGuardQueryType } from '@/__generated__/subscriptionGuardQuery.graphql';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useSubscriptionLockSignal } from '@/lib/subscription-lock-signal';
import { SubscriptionLockProvider } from './subscription-lock-context';
import { resolveSubscriptionStatus, SubscriptionStatus } from './subscription-status';

const subscriptionGuardQuery = graphql`
  query subscriptionGuardQuery {
    subscription {
      id
      status
    }
  }
`;

interface SubscriptionGuardProps {
  children: ReactNode;
}

/**
 * Resolves the current subscription status and provides it via context so the
 * rest of the app can react to lock state. Deliberately does NOT redirect —
 * the actual swap of the main content happens in `AppShell` based on the
 * context, which keeps rendering synchronous and avoids redirect races.
 *
 * It also deliberately does NOT suspend its children. It used to: the query sat
 * in a `Suspense` whose fallback replaced the entire app shell, so a cold start
 * mounted the chrome as a skeleton, threw it away, and mounted the real chrome —
 * two shell mounts and two skeleton phases for one page load. The query now runs
 * in a hydrator beside the tree (the same shape as `UnreadCountsHydrator`),
 * reporting into state; `children` — the shell — render immediately and stay
 * mounted, and the page area holds its skeleton via `isResolved` until the
 * answer lands.
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  // Reactive: the shell now mounts before the flags query answers, and a snapshot
  // read of `billings` would settle on `false` and leave the lock permanently
  // bypassed for a tenant that has it on.
  const billingsEnabled = useFeatureFlag('billings');

  if (!billingsEnabled) {
    return <>{children}</>;
  }

  return <SubscriptionStatusResolver>{children}</SubscriptionStatusResolver>;
}

function SubscriptionStatusResolver({ children }: { children: ReactNode }) {
  const trialExpiredFromErrors = useSubscriptionLockSignal(s => s.trialExpiredFromErrors);
  // `null` = the query has not answered yet, which is NOT the same as "no
  // subscription" (that answer is CANCELED). See `isResolved` on the context.
  const [queriedStatus, setQueriedStatus] = useState<SubscriptionStatus | null>(null);

  // A trial expiry detected from other queries' errors is already an answer, so
  // it wins immediately instead of waiting on this query.
  const status = trialExpiredFromErrors ? SubscriptionStatus.TRIAL_EXPIRED : queriedStatus;

  return (
    <>
      {/* No error boundary on purpose: a throw here propagates exactly as it did
          when this query drove a Suspense boundary directly. Swallowing it would
          leave the status null forever and strand the page area on its skeleton
          with nothing to signal why. */}
      <Suspense fallback={null}>
        <SubscriptionStatusHydrator onResolved={setQueriedStatus} />
      </Suspense>
      <SubscriptionLockProvider status={status}>{children}</SubscriptionLockProvider>
    </>
  );
}

/**
 * Runs the query and reports the resolved status up. Renders nothing, so the
 * `Suspense` it sits in never blanks any UI while the request is in flight.
 */
function SubscriptionStatusHydrator({ onResolved }: { onResolved: (status: SubscriptionStatus) => void }) {
  const data = useLazyLoadQuery<SubscriptionGuardQueryType>(
    subscriptionGuardQuery,
    {},
    { fetchPolicy: 'store-and-network' },
  );

  // A plain enum string, so the effect re-fires only on a real status change and
  // not on every fresh Relay snapshot object.
  const status =
    data.subscription == null ? SubscriptionStatus.CANCELED : resolveSubscriptionStatus(data.subscription.status);

  useEffect(() => {
    onResolved(status);
  }, [status, onResolved]);

  return null;
}
