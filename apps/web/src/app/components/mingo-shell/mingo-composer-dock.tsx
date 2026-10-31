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
 *   context memory, quick actions, identity, the dialog actions, Compact among them
 *   in the chat's ⋯).
 * - Which chat it writes into, and the navigation a new chat triggers:
 *   `useComposerTarget`. Launcher requests: `useComposerLauncherDrain`.
 * - The Getting Started tour (onboarding v2): `useMingoTour` — Mingo's greeting at the
 *   head of the tour's conversation and its step block above the composer, on every
 *   page while that conversation is the open one. A step chip sends into it and opens
 *   its section; it does not follow to the chat page, the block stays over the dock.
 *   "Reset Onboarding" in the chat's ⋯ once the tour is over.
 * - Per route (`dockViewOf`): width, placeholder, memory strip. The model row
 *   is on every route, so the composer keeps its height from page to page.
 * - A phone draws it under its pages only while the chat is over them (the sheet,
 *   which takes the screen there), and on Mingo's home and the chat page.
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
  ModelDisplay,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  Chevron02UpIcon,
  Collapse02Icon,
  Expand02Icon,
  MessageTextIcon,
  Refresh01RightIcon,
  XmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { useMingoContextMemory } from '@/app/(app)/mingo/context/use-context-memory';
import {
  type MingoChat,
  type MingoChatState,
  useMingoChatSurface,
} from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useMingoTour } from '@/app/(app)/mingo/tour/use-mingo-tour';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isMobileShell } from '@/lib/platform';
import { isMingoWhatToAsk, routes } from '@/lib/routes';
import { ResetInitialSetupDialog, useDevOnboardingMenuItems } from '../dev-onboarding-shortcuts';
import { ResetOnboardingDialog, useCanResetOnboarding } from '../reset-onboarding-dialog';
import { useChatPageNodeStore } from './chat-page-node-store';
import { useComposerPreviewStore } from './composer-preview-store';
import { MingoDockErrorBoundary } from './mingo-dock-error-boundary';
import { MingoDockQuickActions } from './mingo-dock-quick-actions';
import {
  canShowSheet,
  type ComposerRoute,
  composerRouteOf,
  dockViewOf,
  isSheetRoute,
  showsDockQuickActions,
} from './mingo-dock-route';
import { isSheetUp, useMingoSheetStore } from './mingo-sheet-store';
import { useChatBehindPage } from './use-chat-behind-page';
import { useComposerLauncherDrain, usePublishComposerDock } from './use-composer-launcher-drain';
import { useComposerTarget } from './use-composer-target';
import { useOpenframeChatProps } from './use-openframe-chat-props';
import { usePageChip } from './use-page-chip';

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

/** The context strip's chips, one row that scrolls sideways: the live composer's and its loading form's. */
function ContextChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-hide flex min-w-0 shrink items-center gap-[var(--spacing-system-xs)] overflow-x-auto">
      {children}
    </div>
  );
}

/**
 * The composer's place while the chat is not up: the real composer, locked, with the
 * route's prompt where the input will be, the context memory (a local store, known at
 * once) and the row under it, the model as a skeleton. The same card and rows the chat
 * draws, so nothing moves when it lands.
 */
function DockComposerLoading({ route, quickActions = false }: { route: ComposerRoute; quickActions?: boolean }) {
  const view = dockViewOf(route);
  const memory = useMingoContextMemory();
  // The page's chip, known from the URL at once: the strip it heads is drawn from the first
  // frame, as the live composer draws it, so the dock does not grow when the chat lands.
  const pageChip = usePageChip(route, noop);
  return (
    <LoadingRegion label="Loading Mingo">
      {/* The home's quick actions in their loading form (the scope), so the dock is its
          loaded height from the first frame and the greeting centred above it stays put. */}
      {quickActions && <MingoDockQuickActions onSend={noop} />}
      <ChatComposer
        lock={{ placeholder: view.placeholder }}
        inputRef={null}
        onSend={noop}
        onStop={noop}
        sending={false}
        placeholder={view.placeholder}
        contextPicker={LOADING_PICKER}
        contextMemoryItems={view.showContextMemory ? memory.items : undefined}
        contextLeading={pageChip ? <ContextChipRow>{pageChip}</ContextChipRow> : undefined}
        safeAreaBottom={false}
      />
      {/* The row under the input, as the live composer lays it out (its own footer slot
          cannot hold the model). Under the composer's bottom padding — the gap the live
          row has above it — and with the live composer's bottom inset. */}
      <div
        className="flex w-full items-center gap-2 px-[var(--spacing-system-m)] pb-[var(--spacing-system-xxs)]"
        style={
          isMobileShell() ? undefined : { paddingBottom: 'max(var(--spacing-system-xxs), env(safe-area-inset-bottom))' }
        }
      >
        <div className="min-w-0 flex-1">
          <ModelDisplay loading />
        </div>
      </div>
    </LoadingRegion>
  );
}

/**
 * `held`: the landing page waits for the onboarding answer (`holdsDashboard`): the dock is
 * its loading form, with no chat state running, until the session is known to stay.
 */
export function MingoComposerDock({ held = false }: { held?: boolean }) {
  const pathname = usePathname();
  const route = composerRouteOf(pathname);
  usePublishComposerDock();
  // A phone has no composer under its pages: the chat takes the screen when it is
  // asked for (the top bar's Mingo button, a history row, a notification), in the
  // sheet over the page, with this composer under it. Mingo's home and the chat page
  // are that chat already. Decided in CSS, so the first paint is right; hidden, it
  // stays mounted (the draft and the uploads with it) and takes no room.
  const sheetUp = useMingoSheetStore(s => isSheetUp(s, pathname)) && canShowSheet(route);
  const offOnPhone = isSheetRoute(route) && !sheetUp;

  return (
    // Centred at the route's width, a step below the page's last line. No overflow
    // clipping and no transform here: the composer's popovers open above it. Named
    // here: an inline chat names itself through its host's region.
    <section
      aria-label="Mingo AI chat"
      // `pointer-events-auto`: a floating dock leaves the pointer to the page around it.
      className={cn(
        'pointer-events-auto mx-auto w-full min-w-0 pt-[var(--spacing-system-mf)]',
        dockViewOf(route).widthClassName,
        offOnPhone && 'max-md:hidden',
      )}
    >
      <MingoDockErrorBoundary>
        {held ? (
          <DockComposerLoading route={route} quickActions={showsDockQuickActions(route)} />
        ) : (
          <DockSurface route={route} quickActions={showsDockQuickActions(route) && !sheetUp} />
        )}
      </MingoDockErrorBoundary>
    </section>
  );
}

function DockSurface({ route, quickActions }: { route: ComposerRoute; quickActions: boolean }) {
  // A surface for the whole session: the chat state runs while the dock is mounted.
  const { chat, error, enabled, identityEnabled, compactDialog, copyDialogLink } = useMingoChatSurface();
  if (error) throw error;
  // Disabled = no session yet (the paywall unmounts the dock): the composer's place, locked.
  // The quick actions' place too, so the dock is its loaded height from the first frame and
  // nothing above it moves.
  if (!enabled || !chat) return <DockComposerLoading route={route} quickActions={quickActions} />;
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
  // The chat over the page (`MingoComposerSheet`): over plain pages, and over home for
  // a chat collapsed back from its page (`canShowSheet`).
  const sheetOpen = useMingoSheetStore(s => isSheetUp(s, pathname)) && canShowSheet(route);
  const sheetNode = useMingoSheetStore(s => s.node);
  const showSheet = useMingoSheetStore(s => s.show);
  const hideSheet = useMingoSheetStore(s => s.hide);
  const showSheetAfterNavigation = useMingoSheetStore(s => s.showAfterNavigation);
  const openFull = useMingoSheetStore(s => s.openFull);
  const lastPage = useMingoSheetStore(s => s.lastPage);
  // The chat page holding "What to ask Mingo?": a chat not created yet, on its page.
  const query = useSearchParams();
  const whatToAskPage = route === 'chat' && isMingoWhatToAsk(query);
  // A phone has no composer under its pages, and a chat there takes the screen: its page.
  const phone = useMdUp() === false;
  // State, not a ref: the chat module loads lazily, and the launcher drain waits for it.
  const [handle, setHandle] = useState<EmbeddableChatHandle | null>(null);
  // Tells the chat page whether a chat will portal into it (it draws a skeleton until then).
  // A layout effect: the handle lands in the commit the chat mounts, so both flip in one paint.
  const setChatMounted = useChatPageNodeStore(s => s.setChatMounted);
  useLayoutEffect(() => {
    setChatMounted(handle !== null);
    return () => setChatMounted(false);
  }, [handle, setChatMounted]);
  // Only once the page lets the thread in: it holds its skeleton until the conversation has loaded.
  const chatPageNode = useChatPageNodeStore(s => (s.threadReady ? s.node : null));
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
    sheetOpen,
    phone,
  });
  useComposerLauncherDrain({
    handle,
    route,
    sendInNewDialog: target.sendInNewDialog,
    createIntentDialog: target.createIntentDialog,
    selectDialog: chat.state.selectDialog,
    openSheet: showSheet,
    whatToAskPage,
    phone,
    navigate,
  });

  const chatProps = useOpenframeChatProps({
    chat,
    copyDialogLink,
    compactDialog,
    sendInNewDialog: target.sendInNewDialog,
  });

  // Over a page: the open chat is one click away. Up, its header leads to the chat's
  // own page or back to this one; down, a chip at the start of the composer's context
  // strip brings it back ("Continue …"), and the prompt says the reply continues it.
  // Its × lets the chat go: the next send from the page starts a new one in the sheet.
  const openDialogId = chat.state.activeDialogId ?? null;
  const onSheetRoute = isSheetRoute(route);
  // Every chat on its page collapses back to the last page this tab was on, raised
  // over it again, or closes there, leaving it behind the page ("Continue …"); to
  // Mingo's home when there is none. "What to ask Mingo?" as well, before its chat exists.
  const collapseTo =
    route === 'chat' && (openDialogId !== null || whatToAskPage) ? (lastPage ?? routes.mingo.home) : null;
  let threadHeaderActions;
  // A phone: none. The top bar's Mingo button is the chat's × there, and a chat has no
  // smaller form to go to.
  if (phone) threadHeaderActions = undefined;
  else if (sheetOpen) {
    // A chat not created yet (the suggestions of "What to ask Mingo?") has no page of its own.
    threadHeaderActions = [
      ...(openDialogId
        ? [
            {
              id: 'open-full-chat',
              label: 'Open as full chat',
              icon: <Expand02Icon size={24} />,
              onClick: () => {
                openFull();
                navigate(routes.mingo.chat(openDialogId));
              },
            },
          ]
        : []),
      { id: 'back-to-page', label: 'Back to page', icon: <XmarkIcon size={24} />, onClick: hideSheet },
    ];
  } else if (collapseTo !== null) {
    threadHeaderActions = [
      {
        id: 'back-to-page',
        label: 'Back to page',
        icon: <Collapse02Icon size={24} />,
        onClick: () => {
          showSheetAfterNavigation();
          navigate(collapseTo);
        },
      },
      { id: 'close-chat', label: 'Close chat', icon: <XmarkIcon size={24} />, onClick: () => navigate(collapseTo) },
    ];
  }
  const continuing = onSheetRoute && !sheetOpen && openDialogId !== null;
  const openTitle = chat.state.dialogs.find(dialog => dialog.id === openDialogId)?.title ?? 'chat';
  const shortTitle = openTitle.length > CONTINUE_TITLE_MAX ? `${openTitle.slice(0, CONTINUE_TITLE_MAX)}…` : openTitle;
  const messageCount = chat.state.messages.length;
  const pageChip = usePageChip(route, prompt => void target.sendInNewDialog(prompt));
  const continueChip = continuing ? (
    <div role="group" aria-label="Chat behind this page" className="flex shrink-0">
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
  // skipped) — in the chat's ⋯, after the chat's own actions, as the v2 panel had it;
  // the dev/QA onboarding shortcuts follow it. Only with onboarding v2: without it
  // this shell has no tour to replay.
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  const canResetOnboarding = useCanResetOnboarding();
  const [resetOnboardingOpen, setResetOnboardingOpen] = useState(false);
  const [resetInitialSetupOpen, setResetInitialSetupOpen] = useState(false);
  const devOnboardingItems = useDevOnboardingMenuItems(() => setResetInitialSetupOpen(true));
  const onboardingItems = [
    ...(canResetOnboarding
      ? [
          {
            id: 'reset-onboarding',
            label: 'Reset Onboarding',
            icon: <Refresh01RightIcon className="h-5 w-5 text-ods-text-secondary" />,
            onClick: () => setResetOnboardingOpen(true),
          },
        ]
      : []),
    ...devOnboardingItems,
  ];
  const chatMenuExtraItems = onboardingV2 === 'on' && onboardingItems.length > 0 ? onboardingItems : undefined;

  return (
    <>
      {/* Mingo's quick actions over the composer on every route but the chat page, for the page's
          topic, sent through the dock's own send (a new chat, over the page off home). Not under the
          sheet: the composer then replies to the chat in it. */}
      {showsDockQuickActions(route) && !sheetOpen && (
        <MingoDockQuickActions onSend={text => void target.sendInNewDialog(text)} />
      )}
      {/* The chat module loads lazily and draws nothing until it has. */}
      {!handle && <DockComposerLoading route={route} />}
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
        // conversation is open.
        aboveComposer={tour.aboveComposer}
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
        // "Continue …" for the chat behind the page, then the page itself: one row of chips
        // that scrolls sideways when the strip is too narrow for all of them.
        composerContextLeading={
          continueChip || pageChip ? (
            <ContextChipRow>
              {continueChip}
              {pageChip}
            </ContextChipRow>
          ) : undefined
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
        // One bottom inset: in the phone shell the layout root already pads it (and the
        // keyboard's, `.app-shell-root` in globals.css), so the composer must not add it
        // again. On the web (iOS Safari, `viewport-fit=cover`) the composer's is the one.
        safeAreaBottom={!isMobileShell()}
        composerPreviewText={previewText}
        // Mingo's edge light around the input, the hub launcher's: the one place to ask Mingo.
        composerEdgeLight
      />
      <ResetOnboardingDialog
        open={resetOnboardingOpen}
        onOpenChange={setResetOnboardingOpen}
        // The tour starts over from the wizard's "Start with Mingo": this menu is
        // on every page, so the reset takes the user there.
        onReset={() => router.push(routes.setup)}
      />
      <ResetInitialSetupDialog
        open={resetInitialSetupOpen}
        onOpenChange={setResetInitialSetupOpen}
        onReset={() => router.push(routes.setup)}
      />
    </>
  );
}
