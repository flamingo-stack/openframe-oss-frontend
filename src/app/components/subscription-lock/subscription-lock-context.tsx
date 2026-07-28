'use client';

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { isLockingStatus, type SubscriptionStatus } from './subscription-status';

interface SubscriptionLockState {
  status: SubscriptionStatus;
  isLocked: boolean;
}

const SubscriptionLockContext = createContext<SubscriptionLockState | null>(null);

interface SubscriptionLockProviderProps {
  status: SubscriptionStatus;
  children: ReactNode;
}

export function SubscriptionLockProvider({ status, children }: SubscriptionLockProviderProps) {
  // Status + whether it locks, nothing more: the lock's wording is resolved by
  // whichever lock screen actually renders (`subscription-lock-content.tsx`), so
  // the plan-picker copy stays out of this app-wide provider's import graph.
  const value = useMemo<SubscriptionLockState>(() => ({ status, isLocked: isLockingStatus(status) }), [status]);

  return <SubscriptionLockContext.Provider value={value}>{children}</SubscriptionLockContext.Provider>;
}

export function useSubscriptionLock(): SubscriptionLockState {
  const ctx = useContext(SubscriptionLockContext);
  if (!ctx) {
    return { status: 'ACTIVE', isLocked: false };
  }
  return ctx;
}
