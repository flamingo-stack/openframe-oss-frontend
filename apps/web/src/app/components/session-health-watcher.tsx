'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { resumeSessionPolls } from '@/lib/session-poll';
import { startSessionRevalidation } from '@/lib/session-revalidation';
import { useSubscriptionOpen } from './subscription-lock/subscription-guard';

/**
 * Brings a `paused` session back (`session-health.ts`): restarts the polls the
 * gate stopped once it is healthy again, and re-validates it meanwhile. The
 * probe is background traffic, so it waits for the subscription like any other
 * and mounts below `SubscriptionGuard`.
 */
export function SessionHealthWatcher() {
  const queryClient = useQueryClient();
  const subscriptionOpen = useSubscriptionOpen();

  useEffect(() => resumeSessionPolls(queryClient), [queryClient]);

  useEffect(() => (subscriptionOpen ? startSessionRevalidation() : undefined), [subscriptionOpen]);

  return null;
}
