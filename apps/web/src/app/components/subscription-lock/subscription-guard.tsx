'use client';

import { createContext, type ReactNode, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { subscriptionGuardQuery as SubscriptionGuardQueryType } from '@/__generated__/subscriptionGuardQuery.graphql';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { markSubscriptionLocked, markSubscriptionOpen } from '@/lib/subscription-gate';
import { useSubscriptionLockSignal } from '@/lib/subscription-lock-signal';
import { isLockingStatus, resolveSubscriptionStatus, SubscriptionStatus } from './subscription-status';

const subscriptionGuardQuery = graphql`
  query subscriptionGuardQuery {
    subscription {
      id
      status
    }
  }
`;

interface SubscriptionLockState {
  status: SubscriptionStatus;
  isLocked: boolean;
  /**
   * False only while the subscription query has not answered yet.
   *
   * The app shell renders BEFORE that answer (it must — replacing the shell with
   * a skeleton for the round-trip is what made a cold start mount the whole
   * chrome twice), so it needs to tell "not locked" apart from "not known yet"
   * and hold the page area on its skeleton for the latter. Without the
   * distinction an expired-trial user is shown the app for one paint before the
   * lock screen swaps in.
   */
  isResolved: boolean;
}

const SubscriptionLockContext = createContext<SubscriptionLockState | null>(null);

/**
 * Resolves the current subscription status and publishes it — to the tree via
 * context, and to the network layer via the subscription gate.
 *
 * Deliberately does NOT redirect: the swap of the main content happens in
 * `AppLayout` off the context, which keeps rendering synchronous and avoids
 * redirect races.
 *
 * Deliberately does NOT suspend its children either. It used to: the query sat
 * in a `Suspense` whose fallback replaced the entire app shell, so a cold start
 * mounted the chrome as a skeleton, threw it away, and mounted the real chrome —
 * two shell mounts and two skeleton phases for one page load. The query runs in
 * a hydrator beside the tree instead (the same shape as `UnreadCountsHydrator`),
 * reporting into state; `children` render immediately and stay mounted, and the
 * page area holds its skeleton via `isResolved` until the answer lands.
 *
 * The tree shape here must not depend on anything that resolves later. Branching
 * between `<>{children}</>` and `<Resolver>{children}</Resolver>` once the flag
 * answered put a different element type at the children position, and React
 * discarded the whole shell and mounted it again — the remount this component is
 * built to avoid. Everything below is one fixed shape; only the hydrator's
 * presence varies, and it renders nothing.
 */
export function SubscriptionGuard({ children }: { children: ReactNode }) {
  // Reactive, not a snapshot: the shell mounts before the flags query answers,
  // and a snapshot read of `billings` would settle on `false` and leave the lock
  // permanently bypassed for a tenant that has it on.
  const gate = useFeatureFlagGate('billings');
  const trialExpiredFromErrors = useSubscriptionLockSignal(s => s.trialExpiredFromErrors);
  // `null` = the query has not answered yet, which is NOT the same as "no
  // subscription" (that answer is CANCELED). See `isResolved`.
  const [queriedStatus, setQueriedStatus] = useState<SubscriptionStatus | null>(null);

  // `off` is an ANSWER, not an absence: a workspace without billing is
  // resolved-and-unlocked, exactly what surfaces with no provider above them read
  // (see `useSubscriptionLock`). It outranks the error signal too — with billings
  // off there is no lock for a trial expiry to trip.
  //
  // Otherwise a trial expiry detected from other queries' errors is already an
  // answer, so it wins immediately instead of waiting on this query.
  const status =
    gate === 'off'
      ? SubscriptionStatus.ACTIVE
      : trialExpiredFromErrors
        ? SubscriptionStatus.TRIAL_EXPIRED
        : queriedStatus;

  // The same answer, handed to the network layer: until it lands, no app query
  // leaves, and while it locks, none leaves at all. This is the only place that
  // opens the gate, which is why `subscriptionGuardQuery` bypasses it.
  useEffect(() => {
    if (status == null) return;
    if (isLockingStatus(status)) {
      markSubscriptionLocked();
    } else {
      markSubscriptionOpen();
    }
  }, [status]);

  const value = useMemo<SubscriptionLockState>(
    () => ({
      status: status ?? SubscriptionStatus.ACTIVE,
      // Never report a lock before the answer: the shell keys its `disabled`
      // chrome off this, and locking the nav on a guess would flicker it.
      isLocked: status != null && isLockingStatus(status),
      isResolved: status != null,
    }),
    [status],
  );

  return (
    <>
      {/* No error boundary on purpose: a throw here propagates exactly as it did
          when this query drove a Suspense boundary directly. Swallowing it would
          leave the status null forever and strand the page area on its skeleton
          with nothing to signal why. */}
      <Suspense fallback={null}>
        {gate === 'on' && <SubscriptionStatusHydrator onResolved={setQueriedStatus} />}
      </Suspense>
      <SubscriptionLockContext.Provider value={value}>{children}</SubscriptionLockContext.Provider>
    </>
  );
}

/**
 * Surfaces with no guard above them (billings flag off, auth screens) are not
 * subject to the lock at all, so they read as resolved-and-unlocked rather than
 * waiting on an answer that will never come.
 */
export function useSubscriptionLock(): SubscriptionLockState {
  return (
    useContext(SubscriptionLockContext) ?? {
      status: SubscriptionStatus.ACTIVE,
      isLocked: false,
      isResolved: true,
    }
  );
}

/**
 * "May automatic, non-user-initiated traffic go out right now?" — `false` until
 * the subscription query has answered, and `false` for as long as the workspace
 * is locked.
 *
 * This is the mechanism behind a rule the network layer cannot enforce on its
 * own. `subscription-gate.ts` parks QUERIES until the answer lands and holds
 * them while it locks, but every MUTATION bypasses it by design — mutations are
 * deliberate user actions, and the ones on the paywall are exactly what a locked
 * workspace needs. `useMutation` also takes no `cacheConfig`, so there is no
 * per-call opt-out to draw a narrower line with.
 *
 * A mutation fired by a TIMER rather than by a click falls straight through that
 * hole: it goes out on a locked workspace, comes back `SUBSCRIPTION_*` with a
 * null payload, and does it again on the next interval, forever. That is exactly
 * what `recordPresence` did — one console error every ten seconds behind the
 * lock screen.
 *
 * So background components ask HERE, which means they must be mounted BELOW the
 * guard. Above it there is no context to read, and this deliberately does NOT
 * fall back the way `useSubscriptionLock` does: it fails closed (no traffic) and
 * says why in dev, rather than quietly answering "open" and reopening the hole.
 */
export function useSubscriptionOpen(): boolean {
  const state = useContext(SubscriptionLockContext);

  if (state === null && process.env.NODE_ENV !== 'production') {
    console.error(
      '[SubscriptionGuard] useSubscriptionOpen() found no <SubscriptionGuard> above it. ' +
        'The component issuing background traffic is mounted outside the guard, so it can never run — ' +
        'move it below <SubscriptionGuard> in `app-layout.tsx`.',
    );
  }

  return state != null && state.isResolved && !state.isLocked;
}

/**
 * The one part that has to be its own component: `useLazyLoadQuery` suspends,
 * and a hook cannot be called conditionally — so "query only when the flag is on,
 * and blank nothing while it is in flight" is a mount, inside a `Suspense` whose
 * fallback is the nothing this renders.
 */
function SubscriptionStatusHydrator({ onResolved }: { onResolved: (status: SubscriptionStatus) => void }) {
  const data = useLazyLoadQuery<SubscriptionGuardQueryType>(
    subscriptionGuardQuery,
    {},
    {
      fetchPolicy: 'store-and-network',
      // Nothing else can open the subscription gate, so this query must never
      // wait on it — see `subscription-gate.ts`.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
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
