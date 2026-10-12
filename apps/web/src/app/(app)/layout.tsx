'use client';

import { AgentIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components';
import { usePathname } from 'next/navigation';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { AppLayout } from '../components/app-layout';
import { APP_MAIN_CLASS_NAME, getMainClassNameOverride } from '../components/app-shell-chrome';
import { OpenframeChatRuntimeProvider } from '../components/openframe-chat-runtime-provider';
import { CONTENT_ORIGIN } from './help-center/endpoints';

const AGENT_IDENTITIES_URL = `${CONTENT_ORIGIN}/content/api/ai-agents`;

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainClassNameOverride = getMainClassNameOverride(pathname);
  // The identities are read once the session is in place: sent earlier, the read is refused and the
  // refusal starts a token refresh that can end the sign-in in progress (see `sessionReady` in AppShell).
  const { isReady: sessionResolved, isAuthenticated } = useAuthSession();
  // EmbeddableChat now lives inside the app shell as an in-layout
  // `AppLayoutDrawer` (see `AppShell` in `components/app-layout.tsx`): it
  // occupies only the main content area, leaving the header and sidebar
  // visible and interactive, and is opened from a header trigger instead of a
  // body-level floating "Ask AI" button. This provider still supplies the
  // `ChatRuntime` context the chat consumes. Hosts both Guide (SSE → MPH via
  // /guide proxy) and Mingo (NATS → openframe backend) modes side-by-side
  // with an in-panel toggle. The existing `/mingo` route stays untouched
  // during the migration — both surfaces coexist until validation is done.
  // The AI agents' pictures (Fae, Mingo) are their server identities: the lib
  // packages none, so every mark in the app is drawn from this one read, through
  // the same content proxy as the chat.
  return (
    <AgentIdentityProvider endpoint={AGENT_IDENTITIES_URL} enabled={sessionResolved && isAuthenticated}>
      <OpenframeChatRuntimeProvider>
        <AppLayout mainClassName={mainClassNameOverride || APP_MAIN_CLASS_NAME}>{children}</AppLayout>
      </OpenframeChatRuntimeProvider>
    </AgentIdentityProvider>
  );
}
