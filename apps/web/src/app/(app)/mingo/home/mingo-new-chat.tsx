'use client';

import { MingoHomeGreeting } from './mingo-home-greeting';

/**
 * Mingo's home (`/mingo`), what "New chat" opens: the greeting, and under it the shell's
 * docked composer with Mingo's quick actions and "What to ask Mingo?" over it
 * (`MingoDockQuickActions`), always on a new chat. The fleet overview is the dashboard's
 * (`MingoDashboard`).
 */
export function MingoNewChat() {
  return <MingoHomeGreeting />;
}
