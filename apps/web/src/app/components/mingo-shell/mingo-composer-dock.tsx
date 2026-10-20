'use client';

/**
 * MingoComposerDock — the Mingo composer docked under every page of the
 * Mingo-first shell (`AppLayout`'s `composerDock` slot), and the session's ONE
 * `EmbeddableChat`. It is mounted for the whole session, so the draft, the staged
 * context and the uploads survive navigation; on the chat page (`/mingo/chat`) the
 * chat's header and thread portal into the page's node (`useChatPageNodeStore`),
 * everywhere else the composer stands alone.
 *
 * - What the chat can do: `useOpenframeChatProps` (context picker, `@` / slash,
 *   context memory, quick actions, identity, the dialog actions). Compact is a
 *   button under the input (not on home: no chat yet).
 * - Which chat it writes into, and the navigation a new chat triggers:
 *   `useComposerTarget`. Launcher requests: `useComposerLauncherDrain`.
 * - The Getting Started tour (onboarding v2): `useMingoTour` — Mingo's greeting at the
 *   head of the tour's conversation and its step block above the composer, on every
 *   page while that conversation is the open one. A step chip sends into it and opens
 *   its section; it does not follow to the chat page, the block stays over the dock.
 *   "Reset Onboarding" in the chat's ⋯ once the tour is over.
 * - Per route (`dockViewOf`): width, placeholder, memory strip, Compact. The model row
 *   is on every route, so the composer keeps its height from page to page.
 * - Until the chat is up (the session resolving, the chat module loading) the composer's
 *   place holds the real composer, locked, with the model row as a skeleton — so the
 *   page above does not move when it lands. Behind the paywall nothing renders (the
 *   shell passes `null` for the slot there): no chat traffic leaves.
 *
 * Nothing on the dock's ancestors may clip or transform it: the context picker,
 * the `@` / slash menus and the memory popover open above the composer.
 */

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ChatComposer,
  ChatIdentityProvider,
  EmbeddableChat,
  type EmbeddableChatHandle,
  ModelDisplaySkeleton,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  Chevron02UpIcon,
  MessageTextIcon,
  PackageCheckIcon,
  Refresh01RightIcon,
  SidebarFlipIcon,
  SidebarIcon,
  XmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname, useRouter } from 'next/navigation';
import { useLayoutEffect, useState } from 'react';
import { useMingoContextMemory } from '@/app/(app)/mingo/context/use-context-memory';
import {
  type MingoChat,
  type MingoChatState,
  useMingoChatSurface,
} from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useMingoTour } from '@/app/(app)/mingo/tour/use-mingo-tour';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isMobileShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { ResetOnboardingDialog, useCanResetOnboarding } from '../reset-onboarding-dialog';
import { useChatPageNodeStore } from './chat-page-node-store';
import { useComposerPreviewStore } from './composer-preview-store';
import { MingoDockErrorBoundary } from './mingo-dock-error-boundary';
import { MingoDockQuickActions } from './mingo-dock-quick-actions';
import { type ComposerRoute, composerRouteOf, dockViewOf, isSheetRoute } from './mingo-dock-route';
import { useMingoSheetStore } from './mingo-sheet-store';
import { useChatBehindPage } from './use-chat-behind-page';
import { useComposerLauncherDrain, usePublishComposerDock } from './use-composer-launcher-drain';
import { useComposerTarget } from './use-composer-target';
import { useOpenViewChip } from './use-open-view-chip';
import { useOpenframeChatProps } from './use-openframe-chat-props';

/** Whether `href` points at the page `pathname` is on (query aside; `trailingSlash` puts a slash after paths). */
function samePath(href: string, pathname: string | null): boolean {
  const trim = (path: string) => path.replace(/\/+$/, '') || '/';
  return pathname !== null && trim(href.split(/[?#]/)[0]) === trim(pathname);
}

/** The chat page's thread column: the composer's width there. */
const CHAT_COLUMN_WIDTH = dockViewOf('chat').widthClassName;

/** The chat's title for the "Continue" chip: shortened, so the chip leaves room for the strip. */
const CONTINUE_TITLE_MAX = 34;

/** Nothing closes the dock: the lib still reports a same-tab navigation from a thread card as a close. */
const ignoreClose = () => {};
const noop = () => {};

/** The locked composer takes no input; its `+` menu needs a picker to draw the card it sits in. */
const LOADING_PICKER = { entityTypes: [], renderItems: () => null };

/** "Compact chat memory" under the input. Without `onClick` it is the loading composer's, disabled. */
function CompactMemoryButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="link"
      size="compact"
      font="regular"
      noPaddingX
      leftIcon={<PackageCheckIcon />}
      onClick={onClick}
      disabled={!onClick}
    >
      Compact chat memory
    </Button>
  );
}

/**
 * The composer's place while the chat is not up: the real composer, locked, with the
 * route's prompt where the input will be, the context memory (a local store, known at
 * once) and the row under it — the model as a skeleton, and Compact, disabled, where
 * the live composer will offer it. The same card and rows the chat draws, so nothing
 * moves when it lands.
 */
function DockComposerLoading({ route, compact }: { route: ComposerRoute; compact: boolean | 'unknown' }) {
  const view = dockViewOf(route);
  const memory = useMingoContextMemory();
  return (
    <LoadingRegion label="Loading Mingo">
      <ChatComposer
        lock={{ placeholder: view.placeholder }}
        inputRef={null}
        onSend={noop}
        onStop={noop}
        sending={false}
        placeholder={view.placeholder}
        contextPicker={LOADING_PICKER}
        contextMemoryItems={view.showContextMemory ? memory.items : undefined}
        safeAreaBottom={false}
      />
      {/* The row under the input, as the live composer lays it out (its own footer slot
          cannot hold the model). Under the composer's bottom padding — the gap the live
          row has above it — and with the live composer's bottom inset. */}
      <div
        className={cn(
          'flex w-full items-center gap-2 px-[var(--spacing-system-m)] pb-[var(--spacing-system-xxs)]',
          // Compact's row (24px, plus this row's bottom padding) while its flag has not
          // answered: the row it will most likely be.
          compact === 'unknown' && 'min-h-7',
        )}
        style={
          isMobileShell() ? undefined : { paddingBottom: 'max(var(--spacing-system-xxs), env(safe-area-inset-bottom))' }
        }
      >
        <div className="min-w-0 flex-1">
          <ModelDisplaySkeleton />
        </div>
        {compact === true && (
          <div className="flex shrink-0 items-center">
            <CompactMemoryButton />
          </div>
        )}
      </div>
    </LoadingRegion>
  );
}

export function MingoComposerDock() {
  const route = composerRouteOf(usePathname());
  usePublishComposerDock();

  return (
    // Centred at the route's width, a step below the page's last line. No overflow
    // clipping and no transform here: the composer's popovers open above it. Named
    // here: an inline chat names itself through its host's region.
    <section
      aria-label="Mingo AI chat"
      className={cn('mx-auto w-full min-w-0 pt-[var(--spacing-system-mf)]', dockViewOf(route).widthClassName)}
    >
      <MingoDockErrorBoundary>
        <DockSurface route={route} />
      </MingoDockErrorBoundary>
    </section>
  );
}

function DockSurface({ route }: { route: ComposerRoute }) {
  // A surface for the whole session: the chat state runs while the dock is mounted.
  const { chat, error, enabled, identityEnabled, compactDialog, copyDialogLink } = useMingoChatSurface();
  const compactGate = useFeatureFlagGate('mingo-compact-memory');
  if (error) throw error;
  // Disabled = no session yet (the paywall unmounts the dock): the composer's place, locked.
  // Compact shows on the chat page, where a chat is always open, once its flag says so.
  if (!enabled || !chat) {
    const compact = route === 'chat' && (compactGate === 'loading' ? 'unknown' : compactGate === 'on');
    return <DockComposerLoading route={route} compact={compact} />;
  }
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
  const pathname = usePathname();
  const navigate = (href: string) => router.push(href);
  const view = dockViewOf(route);
  // The chat over the page (`MingoComposerSheet`): open on plain pages only.
  const sheetOpen = useMingoSheetStore(s => s.open) && isSheetRoute(route);
  const sheetNode = useMingoSheetStore(s => s.node);
  const showSheet = useMingoSheetStore(s => s.show);
  const hideSheet = useMingoSheetStore(s => s.hide);
  const showSheetAfterNavigation = useMingoSheetStore(s => s.showAfterNavigation);
  const openFull = useMingoSheetStore(s => s.openFull);
  const fullFrom = useMingoSheetStore(s => s.fullFrom);
  const clearFullFrom = useMingoSheetStore(s => s.clearFullFrom);
  // State, not a ref: the chat module loads lazily, and the launcher drain waits for it.
  const [handle, setHandle] = useState<EmbeddableChatHandle | null>(null);
  // Tells the chat page whether a chat will portal into it (it draws a skeleton until then).
  // A layout effect: the handle lands in the commit the chat mounts, so both flip in one paint.
  const setChatMounted = useChatPageNodeStore(s => s.setChatMounted);
  useLayoutEffect(() => {
    setChatMounted(handle !== null);
    return () => setChatMounted(false);
  }, [handle, setChatMounted]);
  const chatPageNode = useChatPageNodeStore(s => s.node);
  // Ghost text from chips drawn outside the chat (Mingo's home Quick Actions).
  const previewText = useComposerPreviewStore(s => s.text);

  // A reload of this tab keeps the chat behind the pages (and their "Continue" chip).
  useChatBehindPage({ route, state: chat.state });

  // The tour decorates the session's state before the send target wraps it: its step
  // chips send through the bare state (the section they open is where the user goes,
  // not the chat page), while the composer's own sends follow to the chat as ever.
  const tour = useMingoTour({
    state: chat.state,
    createNamedDialog: chat.createNamedDialog,
    dialogError: chat.dialogError,
    // A chip's answer opens over the section it opened: at once when that is this
    // page, else on the page the navigation lands on.
    onStepOpened: href => {
      if (samePath(href, pathname)) showSheet();
      else showSheetAfterNavigation();
    },
  });
  const target = useComposerTarget({
    route,
    state: tour.state,
    sendInNewDialog: chat.sendInNewDialog,
    createIntentDialog: chat.createIntentDialog,
    navigate,
    openSheet: showSheet,
  });
  useComposerLauncherDrain({
    handle,
    route,
    sendInNewDialog: target.sendInNewDialog,
    createIntentDialog: target.createIntentDialog,
    selectDialog: chat.state.selectDialog,
    openSheet: showSheet,
    navigate,
  });

  const chatProps = useOpenframeChatProps({ chat, copyDialogLink, sendInNewDialog: target.sendInNewDialog });

  // Over a page: the open chat is one click away. Up, its header leads to the chat's
  // own page or back to this one; down, a chip at the start of the composer's context
  // strip brings it back ("Continue …"), and the prompt says the reply continues it.
  // Its × lets the chat go: the next send from the page starts a new one in the sheet.
  const openDialogId = chat.state.activeDialogId ?? null;
  const onSheetRoute = isSheetRoute(route);
  // A chat opened in full from a page leads back to it, raised over it again.
  const backFromFull =
    route === 'chat' && fullFrom !== null && fullFrom.dialogId === openDialogId ? fullFrom.href : null;
  let threadHeaderActions;
  if (sheetOpen && openDialogId) {
    threadHeaderActions = [
      {
        id: 'open-full-chat',
        label: 'Open as full chat',
        icon: <SidebarIcon size={24} />,
        onClick: () => {
          openFull(`${window.location.pathname}${window.location.search}`, openDialogId);
          navigate(routes.mingo.chat(openDialogId));
        },
      },
      { id: 'back-to-page', label: 'Back to page', icon: <XmarkIcon size={24} />, onClick: hideSheet },
    ];
  } else if (backFromFull !== null) {
    threadHeaderActions = [
      {
        id: 'back-to-page',
        label: 'Back to page',
        icon: <SidebarFlipIcon size={24} />,
        onClick: () => {
          clearFullFrom();
          showSheetAfterNavigation();
          navigate(backFromFull);
        },
      },
    ];
  }
  const continuing = onSheetRoute && !sheetOpen && openDialogId !== null;
  const openTitle = chat.state.dialogs.find(dialog => dialog.id === openDialogId)?.title ?? 'chat';
  const shortTitle = openTitle.length > CONTINUE_TITLE_MAX ? `${openTitle.slice(0, CONTINUE_TITLE_MAX)}…` : openTitle;
  const messageCount = chat.state.messages.length;
  const openViewChip = useOpenViewChip(route);
  const continueChip = continuing ? (
    <div role="group" aria-label="Chat behind this page" className="flex min-w-0 max-w-full shrink">
      <Button
        variant="outline"
        size="compact"
        attach="start"
        leftIcon={<MessageTextIcon />}
        rightIcon={<Chevron02UpIcon />}
        onClick={showSheet}
        title="Reopen this chat"
        className="min-w-0 shrink"
      >
        <span className="truncate">
          Continue “{shortTitle}”{messageCount > 0 ? ` · ${messageCount} messages` : ''}
        </span>
      </Button>
      <Button
        variant="outline"
        size="compact"
        attach="end"
        onClick={() => handle?.startNewChat()}
        aria-label="Start a new chat instead"
        title="Start a new chat instead"
        className="shrink-0 px-[var(--spacing-system-xsf)]"
      >
        <XmarkIcon />
      </Button>
    </div>
  ) : undefined;

  // "Reset Onboarding" replays the Getting Started tour once it is over (finished or
  // skipped) — in the chat's ⋯, after the chat's own actions, as the v2 panel had it.
  // Only with onboarding v2: without it this shell has no tour to replay.
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  const canResetOnboarding = useCanResetOnboarding() && onboardingV2 === 'on';
  const [resetOnboardingOpen, setResetOnboardingOpen] = useState(false);
  const chatMenuExtraItems = canResetOnboarding
    ? [
        {
          id: 'reset-onboarding',
          label: 'Reset Onboarding',
          icon: <Refresh01RightIcon className="h-5 w-5 text-ods-text-secondary" />,
          onClick: () => setResetOnboardingOpen(true),
        },
      ]
    : undefined;

  const activeDialogId = chat.state.activeDialogId;
  // Compact under the input, at the end of the model row: the chat's memory is what
  // that row counts. Not on home (no chat yet), not without the flag.
  // Only while there is a chat to compact: a page with none selected shows no dead link.
  const compactAction =
    view.showCompact && compactDialog && activeDialogId ? (
      <CompactMemoryButton onClick={() => compactDialog(activeDialogId)} />
    ) : undefined;
  // Until Compact can be drawn — its flag unanswered, or the chat page's selection not
  // landed yet — the row keeps its height: the row it will most likely be, rather than
  // one that grows when the answer lands.
  const compactGate = useFeatureFlagGate('mingo-compact-memory');
  const chatOpen = !!activeDialogId || route === 'chat';
  const compactPending = view.showCompact && chatOpen && !compactAction && compactGate !== 'off';

  return (
    <>
      {/* Home: Mingo's quick actions over the composer, sent through the dock's own send. */}
      {route === 'home' && <MingoDockQuickActions onSend={text => void target.sendInNewDialog(text)} />}
      {/* The chat module loads lazily and draws nothing until it has. */}
      {!handle && (
        <DockComposerLoading route={route} compact={compactAction ? true : compactPending ? 'unknown' : false} />
      )}
      <EmbeddableChat
        ref={setHandle}
        shell="inline"
        appearance="v2"
        open
        onOpenChange={ignoreClose}
        closable={false}
        {...chatProps}
        mingoState={target.mingoState}
        // The Getting Started tour: its block above the composer while its
        // conversation is open, and "What to ask Mingo?" leading back to it.
        aboveComposer={tour.aboveComposer}
        onWhatToAsk={tour.onWhatToAsk}
        chatMenuExtraItems={chatMenuExtraItems}
        contextMemory={view.showContextMemory ? chatProps.contextMemory : undefined}
        // An element on the chat page, `null` everywhere else — never `undefined`,
        // which switches the chat back to its in-place layout and remounts the
        // composer (draft and all).
        // The chat page's node on the chat page, the sheet's while it is up over a page.
        threadContainer={route === 'chat' ? chatPageNode : sheetOpen ? sheetNode : null}
        threadHeaderActions={threadHeaderActions}
        // On the chat page the thread is a column at the composer's width under a full-width
        // header; in the sheet it fills the sheet.
        threadContentClassName={route === 'chat' ? cn('mx-auto w-full', CHAT_COLUMN_WIDTH) : undefined}
        // "Continue …" for the chat behind the page, then the entity the page shows.
        composerContextLeading={
          continueChip && openViewChip ? (
            <>
              {continueChip}
              {openViewChip}
            </>
          ) : (
            (continueChip ?? openViewChip ?? undefined)
          )
        }
        rail="none"
        renameMode="inline"
        onModelClick={() => navigate(routes.settings.aiSettings({ tab: 'mingo' }))}
        modelTooltip="Change in Settings → AI Settings"
        // Over the page the thread is the chat's: its prompt; behind it, "continue or ask anew".
        composerPlaceholder={
          sheetOpen
            ? dockViewOf('chat').placeholder
            : continuing
              ? 'Reply, or ask something else about this page…'
              : view.placeholder
        }
        composerFooterActions={
          compactAction ?? (compactPending ? <span aria-hidden className="block h-6" /> : undefined)
        }
        // One bottom inset: in the phone shell the layout root already pads it (and the
        // keyboard's, `.app-shell-root` in globals.css), so the composer must not add it
        // again. On the web (iOS Safari, `viewport-fit=cover`) the composer's is the one.
        safeAreaBottom={!isMobileShell()}
        composerPreviewText={previewText}
      />
      <ResetOnboardingDialog open={resetOnboardingOpen} onOpenChange={setResetOnboardingOpen} />
    </>
  );
}
