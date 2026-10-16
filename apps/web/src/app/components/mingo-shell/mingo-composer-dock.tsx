'use client';

/**
 * MingoComposerDock — the Mingo composer docked under every page of the
 * Mingo-first shell (`AppLayout`'s `composerDock` slot), and the session's ONE
 * `EmbeddableChat`. It is mounted for the whole session, so the draft, the staged
 * context and the uploads survive navigation; on the chat page (`/mingo/chat`) the
 * chat's header and thread portal into the page's node (`useChatPageNodeStore`),
 * everywhere else the composer stands alone.
 *
 * - What the chat can do is the classic panel's, built by the same
 *   `useOpenframeChatProps`: context picker, `@` / slash, context memory, quick
 *   actions, identity, Reset Onboarding, the dialog actions. Compact moves from the
 *   chat's menus into the composer's ⋯ (not on home: no chat yet).
 * - Which chat it writes into, and the navigation a new chat triggers:
 *   `useComposerTarget`. Launcher requests: `useComposerLauncherDrain`.
 * - Per route (`dockViewOf`): width, placeholder, model row, memory strip, ⋯.
 *   Full-width pages get the input row only.
 * - Behind the paywall nothing renders (the shell also passes `null` for the slot
 *   there): the provider is disabled and no chat traffic leaves.
 *
 * Nothing on the dock's ancestors may clip or transform it: the context picker,
 * the `@` / slash menus and the memory popover open above the composer.
 */

import {
  ChatIdentityProvider,
  EmbeddableChat,
  type EmbeddableChatHandle,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { PackageCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  type MingoChat,
  type MingoChatState,
  useMingoChatSurface,
} from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { isMobileShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { useOpenframeChatProps } from '../openframe-embeddable-chat-entry';
import { useChatPageNodeStore } from './chat-page-node-store';
import { useComposerPreviewStore } from './composer-preview-store';
import { MingoDockErrorBoundary } from './mingo-dock-error-boundary';
import { type ComposerRoute, composerRouteOf, dockViewOf } from './mingo-dock-route';
import { useComposerLauncherDrain, usePublishComposerDock } from './use-composer-launcher-drain';
import { useComposerTarget } from './use-composer-target';

/** Nothing closes the dock: the lib still reports a same-tab navigation from a thread card as a close. */
const ignoreClose = () => {};

export function MingoComposerDock() {
  const route = composerRouteOf(usePathname());
  usePublishComposerDock();

  return (
    // Centred at the route's width. No overflow clipping and no transform here:
    // the composer's popovers open above it. Named here: an inline chat names
    // itself through its host's region.
    <section aria-label="Mingo AI chat" className={cn('mx-auto w-full min-w-0', dockViewOf(route).widthClassName)}>
      <MingoDockErrorBoundary>
        <DockSurface route={route} />
      </MingoDockErrorBoundary>
    </section>
  );
}

function DockSurface({ route }: { route: ComposerRoute }) {
  // A surface for the whole session: the chat state runs while the dock is mounted.
  const { chat, error, enabled, identityEnabled, compactDialog, copyDialogLink } = useMingoChatSurface();
  if (error) throw error;
  // Disabled = no session yet, or a locked workspace: nothing to draw, nothing sent.
  if (!enabled || !chat) return null;
  return (
    // Its own identity provider: the dock sits outside `<main>`, and the provider
    // must not wrap the page (see `MingoChatProvider`). The thread portalled into the
    // chat page still reads it — context follows the React tree.
    <ChatIdentityProvider enabled={identityEnabled}>
      <DockChat route={route} chat={chat} compactDialog={compactDialog} copyDialogLink={copyDialogLink} />
    </ChatIdentityProvider>
  );
}

interface DockChatProps {
  route: ComposerRoute;
  chat: MingoChatState;
  compactDialog: MingoChat['compactDialog'];
  copyDialogLink: MingoChat['copyDialogLink'];
}

function DockChat({ route, chat, compactDialog, copyDialogLink }: DockChatProps) {
  const router = useRouter();
  const navigate = (href: string) => router.push(href);
  const view = dockViewOf(route);
  // State, not a ref: the chat module loads lazily, and the launcher drain waits for it.
  const [handle, setHandle] = useState<EmbeddableChatHandle | null>(null);
  const chatPageNode = useChatPageNodeStore(s => s.node);
  // Ghost text from chips drawn outside the chat (Mingo's home Quick Actions).
  const previewText = useComposerPreviewStore(s => s.text);

  const target = useComposerTarget({
    route,
    state: chat.state,
    sendInNewDialog: chat.sendInNewDialog,
    navigate,
  });
  useComposerLauncherDrain({ handle, route, sendInNewDialog: target.sendInNewDialog, navigate });

  const { props: chatProps, overlays } = useOpenframeChatProps({
    chat,
    // Compact is the composer's here (below), never the chat header's.
    compactDialog: undefined,
    copyDialogLink,
    v2: true,
    sendInNewDialog: target.sendInNewDialog,
  });

  const activeDialogId = chat.state.activeDialogId;
  const composerMenuItems: ActionsMenuItem[] | undefined =
    view.showComposerMenu && compactDialog
      ? [
          {
            id: 'compact',
            label: 'Compact Chat Memory',
            icon: <PackageCheckIcon className="h-full w-full text-ods-text-secondary" />,
            disabled: !activeDialogId,
            onClick: () => {
              if (activeDialogId) compactDialog(activeDialogId);
            },
          },
        ]
      : undefined;

  return (
    <>
      <EmbeddableChat
        ref={setHandle}
        shell="inline"
        appearance="v2"
        open
        onOpenChange={ignoreClose}
        closable={false}
        {...chatProps}
        mingoState={target.mingoState}
        contextMemory={view.showContextMemory ? chatProps.contextMemory : undefined}
        // An element on the chat page, `null` everywhere else — never `undefined`,
        // which switches the chat back to its classic in-place layout and
        // remounts the composer (draft and all).
        threadContainer={route === 'chat' ? chatPageNode : null}
        rail="none"
        renameMode="inline"
        showModel={view.showModel}
        onModelClick={() => navigate(routes.settings.aiSettings({ tab: 'mingo' }))}
        modelTooltip="Change in Settings → AI Settings"
        composerPlaceholder={view.placeholder}
        composerMenuItems={composerMenuItems}
        // One bottom inset: in the phone shell the layout root already pads it (and the
        // keyboard's, `.app-shell-root` in globals.css), so the composer must not add it
        // again. On the web (iOS Safari, `viewport-fit=cover`) the composer's is the one.
        safeAreaBottom={!isMobileShell()}
        composerPreviewText={previewText}
      />
      {overlays}
    </>
  );
}
