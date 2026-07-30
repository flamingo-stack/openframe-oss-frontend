'use client';

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { isLockingStatus, type SubscriptionStatus } from './subscription-status';

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

interface SubscriptionLockProviderProps {
  /** `null` while the query is still in flight — see `isResolved`. */
  status: SubscriptionStatus | null;
  children: ReactNode;
}

export function SubscriptionLockProvider({ status, children }: SubscriptionLockProviderProps) {
  // Status + whether it locks, nothing more: the lock's wording is resolved by
  // whichever lock screen actually renders (`subscription-lock-content.tsx`), so
  // the plan-picker copy stays out of this app-wide provider's import graph.
  const value = useMemo<SubscriptionLockState>(
    () => ({
      status: status ?? 'ACTIVE',
      // Never report a lock before the answer: the shell keys its `disabled`
      // chrome off this, and locking the nav on a guess would flicker it.
      isLocked: status != null && isLockingStatus(status),
      isResolved: status != null,
    }),
    [status],
  );

  return <SubscriptionLockContext.Provider value={value}>{children}</SubscriptionLockContext.Provider>;
}

/**
 * Surfaces with no provider above them (billings flag off, auth screens) are not
 * subject to the lock at all, so they read as resolved-and-unlocked rather than
 * waiting on an answer that will never come.
 */
export function useSubscriptionLock(): SubscriptionLockState {
  const ctx = useContext(SubscriptionLockContext);
  if (!ctx) {
    return { status: 'ACTIVE', isLocked: false, isResolved: true };
  }
  return ctx;
}
