'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useNow } from '@/app/hooks/use-now';
import { greetingFor } from './greeting';

/** Re-read the clock once a minute, so a home left open crosses noon and 18:00. */
const CLOCK_TICK_MS = 60_000;

const subscribeToNothing = () => () => undefined;
const onClient = () => true;
const onServer = () => false;

/**
 * "Morning, {first name}", by the part of the day it is now; `null` until both are known.
 *
 * Neither is known to the server's markup: the hour is the viewer's local one (the server's
 * clock greeted an American evening with "Good morning"), and the name is the session's
 * user, read in the browser. Greeting before then drew one text and swapped it for another.
 */
export function useGreeting(): string | null {
  // `false` in the server's markup and while it hydrates, `true` from the next render.
  const hydrated = useSyncExternalStore(subscribeToNothing, onClient, onServer);
  const user = useAuthStore(state => state.user);
  const now = useNow(CLOCK_TICK_MS);
  if (!hydrated || !user) return null;
  return greetingFor(new Date(now).getHours(), user.firstName);
}

/** The greeting inside its heading, or a bar of the heading's line while it is not known. */
export function GreetingText({ greeting }: { greeting: string | null }) {
  return greeting ?? <TextLineSkeleton type="h2" as="span" width="14ch" />;
}
