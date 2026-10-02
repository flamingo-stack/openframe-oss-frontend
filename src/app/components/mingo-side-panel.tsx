'use client';

import { ChatIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { AppLayoutSidePanelRenderState } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { useEffect } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { ChatDrawerErrorBoundary } from './chat-drawer-error-boundary';
import { OpenframeEmbeddableChatEntry } from './openframe-embeddable-chat-entry';

/**
 * Pages that need the whole content width (a remote screen, a terminal, the
 * script editor): Mingo starts at its minimum there. Path prefixes, matched
 * against the pathname, so they carry no query.
 */
const FULL_WIDTH_PATHS = [
  '/devices/details/remote-desktop',
  '/devices/details/remote-shell',
  '/devices/details/remote-session',
  '/scripts/new',
  '/scripts/edit',
] as const;

export function isFullWidthPage(pathname: string | null): boolean {
  return pathname !== null && FULL_WIDTH_PATHS.some(path => pathname.startsWith(path));
}

interface MingoSidePanelProps extends AppLayoutSidePanelRenderState {
  /** Resolve the chat identity (off in the native shells, see `AppShell`). */
  identityEnabled: boolean;
}

/**
 * Mingo v2: the chat as the layout's side panel. It is always open while it is
 * on screen; only a panel opened from the header (no room to dock, or a phone)
 * can be put away, so only that one offers a close button.
 */
export function MingoSidePanel({ mode, canClose, close, collapse, identityEnabled }: MingoSidePanelProps) {
  // On screen for as long as the layout renders it. The URL sync reads this to
  // keep `?mingoDialog=` on the conversation a docked panel shows.
  const setPanelShown = useMingoLauncherStore(state => state.setPanelShown);
  useEffect(() => {
    setPanelShown(true);
    return () => setPanelShown(false);
  }, [setPanelShown]);

  return (
    <ChatIdentityProvider enabled={identityEnabled}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatDrawerErrorBoundary>
          <OpenframeEmbeddableChatEntry
            shell="inline"
            open
            onOpenChange={open => {
              if (!open) close();
            }}
            closable={canClose}
            // Collapsing only means something in the column; covering the
            // content (full, or a phone) the list toggle is the way back.
            v2={{ onCollapse: mode === 'docked' ? collapse : undefined }}
          />
        </ChatDrawerErrorBoundary>
      </div>
    </ChatIdentityProvider>
  );
}
