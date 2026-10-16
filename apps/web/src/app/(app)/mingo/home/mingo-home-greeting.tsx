'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useNow } from '@/app/hooks/use-now';
import { greetingFor } from './greeting';

/** Re-read the clock once a minute, so a home left open crosses noon and 18:00. */
const CLOCK_TICK_MS = 60_000;

/** The top of Mingo's home: Mingo's mark and "Morning, {first name}". */
export function MingoHomeGreeting() {
  const firstName = useAuthStore(state => state.user?.firstName);
  const now = useNow(CLOCK_TICK_MS);

  return (
    <div className="flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-l)] pt-[var(--spacing-system-xl)]">
      <AgentMark agent="mingo" className="size-8 shrink-0 content-md:size-10" />
      <h1 className="min-w-0 break-words text-ods-text-primary text-h2">
        {greetingFor(new Date(now).getHours(), firstName)}
      </h1>
    </div>
  );
}
