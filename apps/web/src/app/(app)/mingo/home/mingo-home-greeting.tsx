'use client';

import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useNow } from '@/app/hooks/use-now';
import { greetingFor } from './greeting';

/** Re-read the clock once a minute, so a home left open crosses noon and 18:00. */
const CLOCK_TICK_MS = 60_000;

/** "Morning, {first name}", by the part of the day it is now. */
export function useGreeting(): string {
  const firstName = useAuthStore(state => state.user?.firstName);
  const now = useNow(CLOCK_TICK_MS);
  return greetingFor(new Date(now).getHours(), firstName);
}
