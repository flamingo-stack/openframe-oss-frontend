'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { useGreeting } from './mingo-home-greeting';

/**
 * Mingo's home (`/mingo`), what "New chat" opens: the greeting in the middle of the page,
 * and under the page the shell's docked composer with Mingo's quick actions and "What to
 * ask Mingo?" over it (`MingoDockQuickActions`), always on a new chat. The fleet overview
 * is the dashboard's (`MingoDashboard`).
 */
export function MingoNewChat() {
  const greeting = useGreeting();

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-[var(--spacing-system-l)] py-[var(--spacing-system-xl)] text-center">
      <div className="flex items-center justify-center gap-[var(--spacing-system-m)]">
        <AgentMark agent="mingo" className="size-8 shrink-0 content-md:size-10" />
        <h1 className="min-w-0 break-words text-ods-text-primary text-h2">{greeting}</h1>
      </div>
      <p className="mt-[var(--spacing-system-m)] text-ods-text-primary text-h4">
        What needs doing across your fleet today?
      </p>
      <p className="mt-[var(--spacing-system-xs)] max-w-[560px] text-ods-text-secondary text-h6">
        Start with a quick action, or tell Mingo what needs to happen across your devices.
      </p>
    </div>
  );
}
