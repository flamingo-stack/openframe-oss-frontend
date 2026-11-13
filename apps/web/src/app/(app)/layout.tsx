'use client';

import { DocNavigationProvider } from '@flamingo-stack/openframe-frontend-core/components/docs';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { AppLayout } from '../components/app-layout';
import { APP_MAIN_CLASS_NAME, getMainClassNameOverride } from '../components/app-shell-chrome';
import { DeviceStatusSupportGate } from '../components/device-status-support-gate';
import { MingoDialogParamBridge } from '../components/mingo-dialog-param-bridge';
import { OpenframeChatRuntimeProvider } from '../components/openframe-chat-runtime-provider';
import { ShellNavigatorRegistrar } from '../components/shell-navigator-registrar';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainClassNameOverride = getMainClassNameOverride(pathname);
  // EmbeddableChat lives inside the app shell (the composer dock, see `AppShell` in
  // `components/app-layout.tsx`), with routes of its own under `/mingo`. This provider
  // supplies the `ChatRuntime` context the chat consumes, hosting both Guide (SSE →
  // MPH via /guide proxy) and Mingo (NATS → openframe backend) modes. The AI agents'
  // pictures come from `AppAgentIdentityProvider` in the root layout, above the
  // notification popups. `DocNavigationProvider` bridges a document tree (the Knowledge
  // Base page, far below) to the runtime's `navigate`, so a chat link to a document swaps
  // it in place.
  return (
    <DocNavigationProvider>
      <OpenframeChatRuntimeProvider>
        {/* The dialog-open seam's way to navigate from outside React. */}
        <ShellNavigatorRegistrar />
        {/* `?mingoDialog=` from an old link, on any route → the chat page. Its own
            boundary: it reads `useSearchParams()`, which must not suspend the shell. */}
        {/* loading-standard-ok(SUSPENSE_FALLBACK): the bridge draws nothing; it only forwards an old link */}
        <Suspense fallback={null}>
          <MingoDialogParamBridge />
        </Suspense>
        <AppLayout mainClassName={mainClassNameOverride || APP_MAIN_CLASS_NAME}>
          {/* Device lists send MANAGED only to a backend that has it (device status phase 2). */}
          <DeviceStatusSupportGate>{children}</DeviceStatusSupportGate>
        </AppLayout>
      </OpenframeChatRuntimeProvider>
    </DocNavigationProvider>
  );
}
