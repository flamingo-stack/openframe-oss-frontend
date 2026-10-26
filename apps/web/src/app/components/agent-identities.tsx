'use client';

import { AgentIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components';
import type { ReactNode } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { CONTENT_ORIGIN } from '../(app)/help-center/endpoints';

const AGENT_IDENTITIES_URL = `${CONTENT_ORIGIN}/content/api/ai-agents`;

/**
 * The AI agents' identities (Fae, Mingo), for every page: the lib packages no agent picture, so every agent mark is
 * drawn from this one read, through the same content proxy as the chat. Mounted once at the root, because every icon
 * named by a string asks it whether the name is an agent (the auth pages' announcement bar included).
 *
 * The read is sent once the session is in place: sent earlier, it is refused and the refusal starts a token refresh
 * that can end the sign-in in progress (see `sessionReady` in AppShell). Until then (and on the signed-out auth pages)
 * no agent is known, and every name is drawn as the library glyph it names.
 */
export function AgentIdentities({ children }: { children: ReactNode }) {
  const { isReady: sessionResolved, isAuthenticated } = useAuthSession();
  return (
    <AgentIdentityProvider endpoint={AGENT_IDENTITIES_URL} enabled={sessionResolved && isAuthenticated}>
      {children}
    </AgentIdentityProvider>
  );
}
