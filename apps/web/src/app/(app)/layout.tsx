'use client';

import { AgentIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { AppLayout } from '../components/app-layout';
import { APP_MAIN_CLASS_NAME, getMainClassNameOverride } from '../components/app-shell-chrome';
import { MingoDialogParamBridge } from '../components/mingo-dialog-param-bridge';
import { OpenframeChatRuntimeProvider } from '../components/openframe-chat-runtime-provider';
import { ShellNavigatorRegistrar } from '../components/shell-navigator-registrar';
import { CONTENT_ORIGIN } from './help-center/endpoints';

const AGENT_IDENTITIES_URL = `${CONTENT_ORIGIN}/content/api/ai-agents`;

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainClassNameOverride = getMainClassNameOverride(pathname);
  // The identities are read once the session is in place: sent earlier, the read is refused and the
  // refusal starts a token refresh that can end the sign-in in progress (see `sessionReady` in AppShell).
  const { isReady: sessionResolved, isAuthenticated } = useAuthSession();
  // EmbeddableChat lives inside the app shell (see `AppShell` in
  // `components/app-layout.tsx`): in the classic shell as the in-layout drawer or
  // the docked side panel, which occupy only the main content area and leave the
  // header and sidebar interactive. This provider supplies the `ChatRuntime`
  // context the chat consumes, hosting both Guide (SSE → MPH via /guide proxy) and
  // Mingo (NATS → openframe backend) modes. The Mingo-first shell (`mingo-first`,
  // `useShellVariant()`) gives the chat routes of its own under `/mingo`.
  // The AI agents' pictures (Fae, Mingo) are their server identities: the lib
  // packages none, so every mark in the app is drawn from this one read, through
  // the same content proxy as the chat.
  return (
    <AgentIdentityProvider endpoint={AGENT_IDENTITIES_URL} enabled={sessionResolved && isAuthenticated}>
      <OpenframeChatRuntimeProvider>
        {/* The dialog-open seam's way to navigate from outside React. */}
        <ShellNavigatorRegistrar />
        {/* Mingo-first only: `?mingoDialog=` on any route → the chat page. Its own
            boundary: it reads `useSearchParams()`, which must not suspend the shell. */}
        <Suspense fallback={null}>
          <MingoDialogParamBridge />
        </Suspense>
        <AppLayout mainClassName={mainClassNameOverride || APP_MAIN_CLASS_NAME}>{children}</AppLayout>
      </OpenframeChatRuntimeProvider>
    </AgentIdentityProvider>
  );
}
