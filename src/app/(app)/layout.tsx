'use client';

import { usePathname } from 'next/navigation';
import { AppLayout } from '../components/app-layout';
import { APP_MAIN_CLASS_NAME, getMainClassNameOverride } from '../components/app-shell-skeleton';
import { OpenframeChatRuntimeProvider } from '../components/openframe-chat-runtime-provider';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainClassNameOverride = getMainClassNameOverride(pathname);
  // EmbeddableChat now lives inside the app shell as an in-layout
  // `AppLayoutDrawer` (see `AppShell` in `components/app-layout.tsx`): it
  // occupies only the main content area, leaving the header and sidebar
  // visible and interactive, and is opened from a header trigger instead of a
  // body-level floating "Ask AI" button. This provider still supplies the
  // `ChatRuntime` context the chat consumes. Hosts both Guide (SSE → MPH via
  // /guide proxy) and Mingo (NATS → openframe backend) modes side-by-side
  // with an in-panel toggle. The existing `/mingo` route stays untouched
  // during the migration — both surfaces coexist until validation is done.
  return (
    <OpenframeChatRuntimeProvider>
      <AppLayout mainClassName={mainClassNameOverride || APP_MAIN_CLASS_NAME}>{children}</AppLayout>
    </OpenframeChatRuntimeProvider>
  );
}
