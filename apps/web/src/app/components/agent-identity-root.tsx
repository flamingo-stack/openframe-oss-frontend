'use client';

import { AgentIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components';
import type { ReactNode } from 'react';
import { CONTENT_ORIGIN } from '@/app/(app)/help-center/endpoints';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';

const AGENT_IDENTITIES_URL = `${CONTENT_ORIGIN}/content/api/ai-agents`;

/**
 * The AI agents' pictures (Fae, Mingo) for the whole app: they are their server
 * identities — the lib packages none — so every mark is drawn from this one read,
 * through the same content proxy as the chat.
 *
 * Mounted in the root layout, ABOVE the notifications provider, not in `(app)`: the
 * notification popups render in that provider, outside `(app)`'s tree, and a Mingo
 * notification's tile draws the Mingo mark (`notification-category-icons.tsx`). Under
 * `(app)` the popup's mark had no provider: an empty icon box and the lib's
 * "[AgentIdentity] the mark of "mingo" was asked for with no <AgentIdentityProvider>"
 * in the console, in either shell.
 *
 * The identities are read once the session is in place: sent earlier, the read is
 * refused and the refusal starts a token refresh that can end the sign-in in progress
 * (see `sessionReady` in AppShell). Signed out (the auth pages) nothing is read.
 */
export function AppAgentIdentityProvider({ children }: { children: ReactNode }) {
  const { isReady, isAuthenticated } = useAuthSession();
  return (
    <AgentIdentityProvider endpoint={AGENT_IDENTITIES_URL} enabled={isReady && isAuthenticated}>
      {children}
    </AgentIdentityProvider>
  );
}
