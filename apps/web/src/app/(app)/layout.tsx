'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { AppLayout } from '../components/app-layout';
import { APP_MAIN_CLASS_NAME, getMainClassNameOverride } from '../components/app-shell-chrome';
import { MingoDialogParamBridge } from '../components/mingo-dialog-param-bridge';
import { OpenframeChatRuntimeProvider } from '../components/openframe-chat-runtime-provider';
import { ShellNavigatorRegistrar } from '../components/shell-navigator-registrar';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainClassNameOverride = getMainClassNameOverride(pathname);
  // EmbeddableChat lives inside the app shell (see `AppShell` in
  // `components/app-layout.tsx`): in the classic shell as the in-layout drawer or
  // the docked side panel, which occupy only the main content area and leave the
  // header and sidebar interactive. This provider supplies the `ChatRuntime`
  // context the chat consumes, hosting both Guide (SSE → MPH via /guide proxy) and
  // Mingo (NATS → openframe backend) modes. The Mingo-first shell (`mingo-first`,
  // `useShellVariant()`) gives the chat routes of its own under `/mingo`.
  // The AI agents' pictures come from `AppAgentIdentityProvider` in the root layout,
  // above the notification popups.
  return (
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
  );
}
