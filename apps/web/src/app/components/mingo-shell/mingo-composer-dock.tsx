'use client';

/**
 * MingoComposerDock — the Mingo composer docked under every page of the
 * Mingo-first shell (`AppLayout`'s `composerDock` slot), and the session's ONE
 * `EmbeddableChat`. It is mounted for the whole session, so the draft, the staged
 * context and the uploads survive navigation; on the chat page (`/mingo/chat`) the
 * chat's header and thread portal into the page's node (`useChatPageNodeStore`),
 * everywhere else the composer stands alone.
 *
 * - The chat it draws: the session's one engine (`useMingoChatSurface`), handed to the
 *   panel through the lib's `ChatEngineProvider`, so the panel runs no engine of its own.
 *   Its dialog actions (Copy link, Compact among them in the chat's ⋯) are the engine's.
 * - What the chat can do besides: `useOpenframeChatProps` (context picker, `@` / slash,
 *   context memory, quick actions, identity, the row status).
 * - Which chat it writes into, and the navigation a send triggers: `useComposerTarget`,
 *   told of the panel's sends through `onMessageSent`. Launcher requests: `useComposerLauncherDrain`.
 * - The Getting Started tour (onboarding v2): `useMingoTour` — Mingo's greeting at the
 *   head of the tour's conversation and its step block above the composer, on every
 *   page while that conversation is the open one, until its × sets the conversation
 *   aside as any other chat. A step chip sends into it and opens
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
  ChatEngineProvider,
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
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMingoContextMemory } from '@/app/(app)/mingo/context/use-context-memory';
import type { MingoUnifiedChat } from '@/app/(app)/mingo/hooks/use-mingo-unified-chat-state';
import { useMingoChatSurface } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useMingoTour } from '@/app/(app)/mingo/tour/use-mingo-tour';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isMobileShell } from '@/lib/platform';
import { isMingoWhatToAsk, routes } from '@/lib/routes';
import { ResetInitialSetupDialog, useDevOnboardingMenuItems } from '../dev-onboarding-shortcuts';
import { effectiveModeOf, useManhattanCentreStore, workAreaModeOf } from '../manhattan-shell/manhattan-centre-store';
import { manhattanHeaderActions } from '../manhattan-shell/manhattan-chat-header-actions';
import { useManhattanDock } from '../manhattan-shell/manhattan-dock-context';
import { ResetOnboardingDialog, useCanResetOnboarding } from '../reset-onboarding-dialog';
import { useChatPageNodeStore } from './chat-page-node-store';
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
import { useDockComposerInset } from './use-dock-composer-inset';
import { useOpenframeChatProps } from './use-openframe-chat-props';
import { usePageChip } from './use-page-chip';

/** Whether `href` points at the page `pathname` is on (query aside; `trailingSlash` puts a slash after paths). */
function samePath(href: string, pathname: string | null): boolean {
  const trim = (path: string) => path.replace(/\/+$/, '') || '/';
  return pathname !== null && trim(href.split(/[?#]/)[0]) === trim(pathname);
}

/** The chat page's thread column: the composer's width there. */
const CHAT_COLUMN_WIDTH = dockViewOf('chat').widthClassName;

/**
 * The dock's ground: the page's background (`bg-ods-bg`, which follows a chat page's own
 * surface) under the composer, and a fade from transparent into it over the
 * `spacing-system-xlf` (40px) above, the design's `scroll-gradient`.
 */
const DOCK_GROUND_CLASS = cn(
  'pointer-events-auto relative bg-ods-bg',
  "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[var(--spacing-system-xlf)] before:bg-gradient-to-b before:from-transparent before:to-ods-bg before:content-['']",
);

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
  // v2's phone chat list is a panel from the left over the page and its scrim (`useMingoPhoneChatsPanel`): the
  // composer under it stays where it is.
  const offOnPhone = isSheetRoute(route) && !sheetUp;

  return (
    // The dock's ground (Figma `chat/dock`, node 4368:14042): the page's background across the
    // whole width of the column, the composer and its quick actions on it, and over the page's
    // end above it a fade into that background, on every page and in the chat column alike.
    // The ground takes the pointer: over a floating dock the page under it is hidden, so a click
    // there must not reach it; the fade above leaves the pointer to the page.
    <div data-testid="mingo-composer-dock-ground" className={cn(DOCK_GROUND_CLASS, offOnPhone && 'max-md:hidden')}>
      {/* Centred at the route's width, a step below the page's last line. No overflow
          clipping and no transform here: the composer's popovers open above it. Named
          here: an inline chat names itself through its host's region. */}
      <section
        aria-label="Mingo AI chat"
        className={cn('mx-auto w-full min-w-0 pt-[var(--spacing-system-mf)]', dockViewOf(route).widthClassName)}
      >
        <MingoDockErrorBoundary>
          {held ? (
            <DockComposerLoading route={route} quickActions={showsDockQuickActions(route)} />
          ) : (
            <DockSurface route={route} quickActions={showsDockQuickActions(route) && !sheetUp} />
          )}
        </MingoDockErrorBoundary>
      </section>
    </div>
  );
}

function DockSurface({ route, quickActions }: { route: ComposerRoute; quickActions: boolean }) {
  // A surface for the whole session: the chat state runs while the dock is mounted.
  const { chat, error, enabled, identityEnabled } = useMingoChatSurface();
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
      <DockChat route={route} chat={chat} />
    </ChatIdentityProvider>
  );
}

interface DockChatProps {
  route: ComposerRoute;
  chat: MingoUnifiedChat;
}

function DockChat({ route, chat }: DockChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  const navigate = (href: string) => router.push(href);
  const view = dockViewOf(route);
  // Manhattan v2: the open chat sits in the chat column beside the page (or over it, or
  // behind it: `chatView`), not in the sheet. What the sheet did maps onto the column below.
  const manhattan = useManhattanDock();
  const columnNode = useManhattanCentreStore(s => s.threadNode);
  const chatView = useManhattanCentreStore(s => s.chatView);
  const setChatView = useManhattanCentreStore(s => s.setChatView);
  const compact = useManhattanCentreStore(s => s.compact);
  // Below md: the page alone (the chat takes its own page there).
  const mdDown = useMdUp() === false;
  // The composer's side inset, the rule the quick actions row above it reads too.
  const composerInset = useDockComposerInset();
  const shownMode = useManhattanCentreStore(s => s.shownMode);
  const whatToAskInColumn = useManhattanCentreStore(s => s.whatToAskInColumn);
  const setWhatToAskInColumn = useManhattanCentreStore(s => s.setWhatToAskInColumn);
  // As the centre decides it (`ManhattanCentre`): the open chat, its first send on the way, or
  // the "What to ask Mingo?" answer; none, and the column is Start Work.
  const hasConversation =
    (chat.state.activeDialogId ?? null) !== null || whatToAskInColumn || chat.state.messages.length > 0;
  const columnMode = effectiveModeOf(workAreaModeOf(route, hasConversation, chatView, compact, mdDown), shownMode);
  // Start Work in the chat column beside a page: the chat draws no header or thread there, the
  // composer under it starts a new chat, with Mingo's quick actions over it as on Mingo's home.
  const startWorkColumn = manhattan && columnMode !== 'page' && isSheetRoute(route) && !hasConversation;
  const showColumn = () => setChatView('split');
  const hideColumn = () => setChatView('hidden');
  // The chat over the page (`MingoComposerSheet`): over plain pages, and over home for
  // a chat collapsed back from its page (`canShowSheet`). In v2: the chat column on screen.
  const sheetUp = useMingoSheetStore(s => isSheetUp(s, pathname)) && canShowSheet(route);
  const sheetOpen = manhattan ? columnMode !== 'page' : sheetUp;
  const v1SheetNode = useMingoSheetStore(s => s.node);
  const sheetNode = manhattan ? columnNode : v1SheetNode;
  const v1ShowSheet = useMingoSheetStore(s => s.show);
  const showSheet = manhattan ? showColumn : v1ShowSheet;
  const v1HideSheet = useMingoSheetStore(s => s.hide);
  const hideSheet = manhattan ? hideColumn : v1HideSheet;
  const v1ShowSheetAfterNavigation = useMingoSheetStore(s => s.showAfterNavigation);
  // The view is the tab's, not the page's: set now, it holds on the page the navigation lands on.
  const showSheetAfterNavigation = manhattan ? () => setChatView('split') : v1ShowSheetAfterNavigation;
  const openFull = useMingoSheetStore(s => s.openFull);
  const lastPage = useMingoSheetStore(s => s.lastPage);
  const outsidePage = useMingoSheetStore(s => s.outsidePage);
  // The chat page holding "What to ask Mingo?": a chat not created yet, on its page.
  const query = useSearchParams();
  const whatToAskPage = route === 'chat' && isMingoWhatToAsk(query);
  // A phone has no composer under its pages, and a chat there takes the screen: its page.
  // So does Start Work in v2: a chat with messages takes the centre, on its page (plan D8).
  const phone = mdDown || (manhattan && route === 'home');
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

  // A reload of this tab keeps the chat behind the pages (and their "Continue" chip).
  useChatBehindPage({ route, state: chat.state });

  // The tour decorates the session's state (its greeting at the head of its conversation,
  // the tour set aside when that conversation is archived), and that is what the panel
  // draws. Its step chips send through the state (the section they open is where the user
  // goes, not the chat page), while the composer's own sends follow to the chat as ever.
  const { startNewDialog } = chat.state;
  const tour = useMingoTour({
    state: chat.state,
    createNamedDialog: title => startNewDialog({ title }),
    dialogNotFound: chat.dialogNotFound,
    dialogCreatedAt: chat.dialogCreatedAt,
    // A chip's answer opens over the section it opened: at once when that is this
    // page, else on the page the navigation lands on.
    onStepOpened: href => {
      if (samePath(href, pathname)) showSheet();
      else showSheetAfterNavigation();
    },
    onScreen: sheetOpen || route === 'chat',
    // The block's × closes the tour's chat as the chat's own × would: the sheet goes
    // down over the page; its page closes to the page it was opened from ("Close
    // chat"), or on a phone to the last page outside Mingo (the top bar's ×). Behind
    // a page there is nothing to close: the block goes, the "Continue" chip stays.
    onClose: () => {
      if (sheetOpen) hideSheet();
      else if (route === 'chat') navigate(phone ? (outsidePage ?? routes.dashboard) : (lastPage ?? routes.mingo.home));
    },
  });
  const target = useComposerTarget({
    route,
    state: tour.state,
    sendInNewDialog: prompt => startNewDialog({ prompt }),
    createIntentDialog: intent => startNewDialog({ intent }),
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

  // Start Work's "What to ask Mingo?" in the column: the answer opens in a new chat there, once
  // per request (`whatToAskInColumn` stays up until a pick sends or the column lets it go).
  const whatToAskShownRef = useRef(false);
  useEffect(() => {
    if (!whatToAskInColumn) {
      whatToAskShownRef.current = false;
      return;
    }
    if (!manhattan || !handle || whatToAskShownRef.current) return;
    whatToAskShownRef.current = true;
    handle.showWhatToAsk();
  }, [whatToAskInColumn, manhattan, handle]);

  const chatProps = useOpenframeChatProps({ dialogStatusOf: chat.dialogStatusOf });

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
  if (mdDown) threadHeaderActions = undefined;
  else if (manhattan) {
    threadHeaderActions = manhattanHeaderActions({
      route,
      columnMode,
      compact,
      openDialogId,
      // The last page outside Mingo: the page the chat goes back beside (home is a new chat).
      lastPage: outsidePage,
      showBesidePage: () => {
        setChatView('split');
        if (outsidePage) navigate(outsidePage);
      },
      fullScreen: () => setChatView('full'),
      restoreSplit: showColumn,
      // Beside a page the chat goes and the page stays alone, the composer under it starting a
      // new chat ("Show the chat beside the page" brings the column back). In one column the
      // page is what is left already.
      closeChat: () => {
        if (route === 'chat') {
          navigate(routes.mingo.home);
          return;
        }
        handle?.startNewChat();
        setWhatToAskInColumn(false);
        if (!compact) setChatView('hidden');
      },
    });
  } else if (sheetOpen) {
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
      {/* Mingo's quick actions over the composer on Mingo's home (and Start Work in the v2 chat
          column) only. A click sends the action at
          once, in a new chat (the dock's own send, which then opens it). Not under the sheet: the
          composer then replies to the chat in it. */}
      {((showsDockQuickActions(route) && !sheetOpen) || startWorkColumn) && (
        <MingoDockQuickActions
          onSend={text => {
            void target.sendInNewDialog(text);
            // The row goes away with the send: the next message is typed in the composer.
            handle?.focusComposer();
          }}
        />
      )}
      {/* The chat module loads lazily and draws nothing until it has. */}
      {!handle && <DockComposerLoading route={route} />}
      {/* The session's one engine, as the tour decorated it: the panel draws it and runs none of its own. */}
      <ChatEngineProvider engine={tour.state}>
        <EmbeddableChat
          ref={setHandle}
          shell="inline"
          appearance="v2"
          open
          onOpenChange={ignoreClose}
          closable={false}
          {...chatProps}
          // A send from the panel: over the page into the chat it goes to, or followed into the one it creates.
          onMessageSent={target.onMessageSent}
          // The Getting Started tour: its block above the composer while its
          // conversation is open.
          aboveComposer={tour.aboveComposer}
          chatMenuExtraItems={chatMenuExtraItems}
          contextMemory={view.showContextMemory ? chatProps.contextMemory : undefined}
          // An element on the chat page, `null` everywhere else — never `undefined`,
          // which switches the chat back to its in-place layout and remounts the
          // composer (draft and all).
          // The chat page's node on the chat page, the sheet's while it is up over a page.
          // v2: the chat column on every page but home (the thread stays mounted there while
          // the column hides behind the page, plan D9), the chat page's node on the chat page.
          threadContainer={
            route === 'chat'
              ? chatPageNode
              : manhattan
                ? route === 'home' || startWorkColumn
                  ? null
                  : sheetNode
                : sheetOpen
                  ? sheetNode
                  : null
          }
          threadHeaderActions={threadHeaderActions}
          threadHeaderLook={manhattan ? 'column' : undefined}
          // v2: the thread fades out into the composer under it, as a page under the dock; and
          // in a narrow column the composer takes the column's own padding as its edge. A phone
          // has no column (the chat is its own page): the composer keeps its own side inset.
          threadFadeEnd={manhattan}
          composerInset={composerInset === 'wide' ? 'wide' : undefined}
          // On the chat page the thread is a column at the composer's width under a full-width
          // header; in the sheet it fills the sheet.
          threadContentClassName={route === 'chat' && !manhattan ? cn('mx-auto w-full', CHAT_COLUMN_WIDTH) : undefined}
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
            startWorkColumn
              ? dockViewOf('home').placeholder
              : sheetOpen
                ? dockViewOf('chat').placeholder
                : continuing
                  ? 'Reply, or ask something else about this page…'
                  : view.placeholder
          }
          // One bottom inset: in the phone shell the layout root already pads it (and the
          // keyboard's, `.app-shell-root` in globals.css), so the composer must not add it
          // again. On the web (iOS Safari, `viewport-fit=cover`) the composer's is the one.
          safeAreaBottom={!isMobileShell()}
          // Mingo's edge light around the input, the hub launcher's: the one place to ask Mingo.
          composerEdgeLight
        />
      </ChatEngineProvider>
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
