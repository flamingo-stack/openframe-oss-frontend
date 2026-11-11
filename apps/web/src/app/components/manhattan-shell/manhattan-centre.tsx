'use client';

import {
  AppColumnHeader,
  type AppLayoutWorkAreaMode,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { previewFadeMask } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ManhattanStartWork } from '@/app/(app)/mingo/home/manhattan-start-work';
import { useMingoChat, useMingoChatThreadOnScreen } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { type ComposerRoute, composerRouteOf, isSheetRoute } from '@/app/components/mingo-shell/mingo-dock-route';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { navModuleOf, navModuleSectionedLabel } from '@/lib/navigation-config';
import { routes, withMingoDialog } from '@/lib/routes';
import { effectiveModeOf, useManhattanCentreStore, workAreaModeOf } from './manhattan-centre-store';
import { ManhattanComposerPortal, ManhattanComposerSlot } from './manhattan-composer-host';
import { ManhattanDockContext } from './manhattan-dock-context';

/** What the Manhattan v2 centre hands `AppLayout` (`chatColumn`, `workAreaMode`, `pageHeader`, the dock). */
export interface ManhattanCentreSlots {
  /** The columns the centre asks the work area for. */
  mode: AppLayoutWorkAreaMode;
  /** The work area's report of the columns it shows (`AppLayout` `onWorkAreaShownModeChange`). */
  onShownModeChange: (shown: AppLayoutWorkAreaMode) => void;
  /** The chat covers the page (chat full screen): the page is not on screen. */
  pageHidden: boolean;
  chatColumn: ReactNode;
  pageHeader: ReactNode;
  /** The composer dock as the v2 centre holds it: rendered once, in the dock under the page or at the column's foot. */
  wrapDock: (dock: ReactNode) => ReactNode;
  /** The dock lies over the page's end (`composerDockFloats`): only while it is under the page; always on Start Work. */
  dockFloats: (floats: boolean) => boolean;
}

/** `localStorage` key of the chat / page divider. */
export const MANHATTAN_WORK_AREA_STORAGE_KEY = 'of.manhattan.workArea';

/**
 * How far the divider squeezes the chat or the page past its min width: to 30% of it.
 * The column keeps its content at the min width, scrolled sideways, and a shadow along
 * the divider marks it, so the other column keeps growing.
 */
export const MANHATTAN_WORK_AREA_SQUEEZE_FLOOR = 0.3;

/**
 * The Manhattan v2 centre: the chat column and the page column of
 * `AppLayout`'s work area, which shows when (plan D5, table T), and their headers (matrix H).
 * Mounted unconditionally around the layout inside `MingoChatProvider` (it reads the open
 * chat) and told whether it is on through `enabled` (a SaaS tenant); off, it hands `null`.
 */
export function ManhattanCentre({
  enabled,
  compact = false,
  chatEnabled = true,
  startWorkLive = true,
  children,
}: {
  enabled: boolean;
  /** No room for two columns (`ManhattanSqueeze.compact`): one column, the sidebars as drawers. */
  compact?: boolean;
  /** The session has a chat (off behind the paywall): without one every page is alone. */
  chatEnabled?: boolean;
  /** Start Work in the chat column reads its blocks (`ManhattanStartWork` `live`): off while the shell holds. */
  startWorkLive?: boolean;
  children: (centre: ManhattanCentreSlots | null) => ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = composerRouteOf(pathname);
  const { chat } = useMingoChat();
  const openDialogId = chat?.state.activeDialogId ?? null;
  const chatView = useManhattanCentreStore(s => s.chatView);
  const setChatView = useManhattanCentreStore(s => s.setChatView);
  const shownMode = useManhattanCentreStore(s => s.shownMode);
  const setShownMode = useManhattanCentreStore(s => s.setShownMode);
  const whatToAskInColumn = useManhattanCentreStore(s => s.whatToAskInColumn);
  const setWhatToAskInColumn = useManhattanCentreStore(s => s.setWhatToAskInColumn);
  const oneColumn = enabled && compact;
  // A phone: the page alone (its chats are their pages, its list the top bar's Mingo button).
  const phone = useMdUp() === false;
  // Something in the chat column to show: the open chat, its first send on the way (no id yet),
  // or the "What to ask Mingo?" answer. Without one the column is Start Work.
  const hasConversation = openDialogId !== null || whatToAskInColumn || (chat?.state.messages.length ?? 0) > 0;
  const mode = workAreaModeOf(route, hasConversation, chatView, oneColumn, phone, chatEnabled);
  // What is on screen: the page alone where the row had no room for the split asked for.
  const shown = effectiveModeOf(mode, shownMode);

  // The "What to ask Mingo?" answer becomes a chat once a pick sends; leaving for Mingo's own
  // pages (a new chat, a chat's page) lets it go.
  useEffect(() => {
    if (whatToAskInColumn && (openDialogId !== null || route === 'home' || route === 'chat')) {
      setWhatToAskInColumn(false);
    }
  }, [whatToAskInColumn, openDialogId, route, setWhatToAskInColumn]);

  // The dock reads it from the store (it is rendered elsewhere).
  const setCompact = useManhattanCentreStore(s => s.setCompact);
  useEffect(() => setCompact(oneColumn), [oneColumn, setCompact]);
  // A chat opened from the chats drawer: the drawer has done its job.
  const dismissChats = useManhattanCentreStore(s => s.dismissChats);
  const previousDialogRef = useRef(openDialogId);
  useEffect(() => {
    if (previousDialogRef.current === openDialogId) return;
    previousDialogRef.current = openDialogId;
    if (oneColumn && openDialogId !== null) dismissChats();
  }, [oneColumn, openDialogId, dismissChats]);

  // Every page opened comes beside the chat (CU-17tkuw65znp): a page full screen, a chat closed
  // or the chat full over the last page are that page's, not the next one's. In one column
  // (compact) the page is shown and the chat waits behind it.
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    if (!enabled || previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    if (route !== 'page' && route !== 'full-width') return;
    if (oneColumn) {
      if (chatView !== 'hidden') setChatView('hidden');
    } else if (chatView !== 'split') setChatView('split');
  }, [enabled, oneColumn, pathname, route, chatView, setChatView]);

  // One column's own `hidden` (the page shown, the chat behind it) is not the user's choice:
  // widened back to two columns, the chat comes beside the page again.
  const previousOneColumnRef = useRef(oneColumn);
  useEffect(() => {
    if (previousOneColumnRef.current === oneColumn) return;
    previousOneColumnRef.current = oneColumn;
    if (!oneColumn && chatView === 'hidden') setChatView('split');
  }, [oneColumn, chatView, setChatView]);

  // "Close page" with the chat waiting behind the page: the chat stops waiting once its page
  // is on screen (where the view draws nothing), not before — set at the click, the page
  // being left would show the chat beside it until the chat's page loads.
  const showChatOnArrivalRef = useRef(false);
  useEffect(() => {
    if (!showChatOnArrivalRef.current) return;
    if (route === 'chat') {
      showChatOnArrivalRef.current = false;
      setChatView('split');
    }
  }, [route, setChatView]);
  // Gone elsewhere instead (the navigation was overtaken): the request lapses.
  useEffect(() => {
    if (route !== 'chat') showChatOnArrivalRef.current = false;
  }, [pathname, route]);

  // The pages the chat goes back beside ("Show side by side" on a chat's page). The
  // Mingo-first shell records them in its sheet, which v2 does not draw.
  const rememberPage = useMingoSheetStore(s => s.rememberPage);
  const rememberOutsidePage = useMingoSheetStore(s => s.rememberOutsidePage);
  useEffect(() => {
    if (!enabled) return;
    // Without a legacy `?mingoDialog=` (its bridge forwards to the chat page, so going
    // back to the page with it would land on the chat again).
    const href = withMingoDialog(search ? `${pathname}?${search}` : pathname, null);
    if (route !== 'chat') rememberPage(href);
    if (isSheetRoute(route)) rememberOutsidePage(href);
  }, [enabled, pathname, search, route, rememberPage, rememberOutsidePage]);

  const slots: ManhattanCentreSlots | null = enabled
    ? {
        mode,
        onShownModeChange: setShownMode,
        pageHidden: shown === 'chat',
        chatColumn: (
          <ManhattanChatColumn
            shown={shown !== 'page'}
            onScreen={shown !== 'page' && openDialogId !== null}
            startWork={!hasConversation}
            startWorkLive={startWorkLive}
            onCloseStartWork={() => setChatView('hidden')}
            onWhatToAsk={() => setWhatToAskInColumn(true)}
          />
        ),
        // Only beside a chat column: in one column (compact) and on a phone the top bar is the
        // page's chrome, and there is no other column to go full screen over or close back to.
        pageHeader:
          oneColumn || phone ? null : (
            <ManhattanPageHeader
              route={route}
              pathname={pathname}
              mode={shown}
              openDialogId={openDialogId}
              canShowChat={chatEnabled}
              onFullScreen={() => setChatView('hidden')}
              onRestoreSplit={() => setChatView('split')}
              onShowChat={() => {
                showChatOnArrivalRef.current = true;
              }}
            />
          ),
        wrapDock: dock => (
          <>
            <ManhattanComposerPortal>{dock}</ManhattanComposerPortal>
            <ManhattanComposerSlot active={shown === 'page'} />
          </>
        ),
        // Start Work is a page of blocks ("Needs you"), not a centred greeting: the dock lies
        // over its end and the page fades out under it, as on the Mingo-first dashboard.
        dockFloats: floats => shown === 'page' && (floats || route === 'home'),
      }
    : null;

  return <ManhattanDockContext.Provider value={enabled}>{children(slots)}</ManhattanDockContext.Provider>;
}

interface ManhattanChatColumnProps {
  shown: boolean;
  onScreen: boolean;
  /** No conversation to show: Start Work takes the column, over the composer. */
  startWork: boolean;
  startWorkLive: boolean;
  onCloseStartWork: () => void;
  onWhatToAsk: () => void;
}

/**
 * The chat column: the node the session's chat portals its header and thread into, and
 * under it the composer's place while the column is on screen. With no conversation it is
 * Start Work (CU-17tkuw65znp), kept mounted while the column is on screen so its blocks are
 * not read again each time a chat opens or closes.
 */
function ManhattanChatColumn({
  shown,
  onScreen,
  startWork,
  startWorkLive,
  onCloseStartWork,
  onWhatToAsk,
}: ManhattanChatColumnProps) {
  const setThreadNode = useManhattanCentreStore(s => s.setThreadNode);
  // Over Start Work the composer lies over the column's end, as the dock does over Start Work
  // on Mingo's home: Start Work runs on under it and fades out over its height.
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const dockHeight = useElementHeight(startWork ? dock : null);
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-ods-bg">
      {onScreen && <ThreadOnScreen />}
      {shown && (
        <div
          data-testid="manhattan-start-work-column"
          className={cn('flex min-h-0 flex-1 flex-col', !startWork && 'hidden')}
        >
          <AppColumnHeader title="Start Work" onClose={onCloseStartWork} closeLabel="Close Start Work" />
          <div
            data-testid="manhattan-start-work-scroller"
            className="min-h-0 flex-1 overflow-y-auto"
            style={dockHeight > 0 ? previewFadeMask(`calc(100% - ${dockHeight}px)`) : undefined}
          >
            <div style={{ paddingBottom: dockHeight }}>
              <ManhattanStartWork variant="column" live={startWorkLive} onWhatToAsk={onWhatToAsk} />
            </div>
          </div>
        </div>
      )}
      <div
        ref={setThreadNode}
        data-testid="manhattan-chat-thread"
        className={cn('flex min-h-0 flex-1 flex-col', startWork && 'hidden')}
      />
      {/* The composer spans the column (the dock's max width is for under a page). Over Start
          Work it floats: the transparent band around it leaves the pointer to Start Work. */}
      <div
        ref={setDock}
        data-testid="manhattan-column-dock"
        className={cn('shrink-0', startWork && 'pointer-events-none absolute inset-x-0 bottom-0 z-10')}
      >
        <ManhattanComposerSlot active={shown} className="px-[var(--spacing-system-lf)] [&_section]:max-w-none" />
      </div>
    </div>
  );
}

/** An element's height, live (`ResizeObserver`, which reports it once on observe); 0 without one. */
function useElementHeight(element: HTMLElement | null): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return element ? height : 0;
}

/** The open chat's thread is on screen (its notifications skip the popup and are read on arrival). */
function ThreadOnScreen() {
  useMingoChatThreadOnScreen();
  return null;
}

/**
 * The title of a page the navigation has no entry for (reached from Start Work, the chat
 * history's ⋯ or a notification). Path prefixes, compared as the sidebar's active checks are.
 */
const PAGES_OUTSIDE_NAV: ReadonlyArray<{ prefix: string; title: string }> = [
  { prefix: routes.mingo.archive, title: 'Chat Archive' },
  { prefix: routes.approvals, title: 'Needs approval' },
  { prefix: '/notifications', title: 'Notifications' },
];

function pageTitleOutsideNav(pathname: string | null): string {
  if (!pathname) return '';
  return PAGES_OUTSIDE_NAV.find(page => pathname.startsWith(page.prefix))?.title ?? '';
}

interface ManhattanPageHeaderProps {
  route: ComposerRoute;
  pathname: string | null;
  mode: AppLayoutWorkAreaMode;
  openDialogId: string | null;
  /** The session has a chat to bring back beside the page (not behind the paywall). */
  canShowChat: boolean;
  onFullScreen: () => void;
  onRestoreSplit: () => void;
  /** "Close page" with a chat waiting behind: it no longer waits (`chatView` back to `split` once its page is up). */
  onShowChat: () => void;
}

/**
 * The page column's header (plan matrix H): Start Work's title alone; on a page its
 * module's name, then in split "Full screen" (the chat waits behind the page) and
 * "Close page" (the chat alone, on its page), alone (the user's full screen or closed chat)
 * "Show the chat beside the page" — the chat, or Start Work with none open — and "Close page"
 * (that chat on its page; Start Work when no chat is open). A chat's own page draws none: the
 * chat's header is its header.
 */
function ManhattanPageHeader({
  route,
  pathname,
  mode,
  openDialogId,
  canShowChat,
  onFullScreen,
  onRestoreSplit,
  onShowChat,
}: ManhattanPageHeaderProps) {
  const router = useRouter();
  if (route === 'chat') return null;
  if (route === 'home') return <AppColumnHeader title="Start Work" />;
  const moduleId = pathname ? navModuleOf(pathname) : null;
  const title = moduleId ? navModuleSectionedLabel(moduleId) : pageTitleOutsideNav(pathname);
  // The open chat alone, on its page, whether it sits beside the page or waits behind it
  // (page full screen); Start Work only when no chat is open.
  // The chat comes forward: the next page shows it beside, as after closing from split.
  const closePage = () => {
    if (!openDialogId) {
      router.push(routes.mingo.home);
      return;
    }
    if (mode !== 'split') onShowChat();
    router.push(routes.mingo.chat(openDialogId));
  };
  if (mode === 'split') {
    return (
      <AppColumnHeader
        title={title}
        layoutAction="fullscreen"
        layoutActionLabel="Full screen page"
        onLayoutAction={onFullScreen}
        onClose={closePage}
        closeLabel="Close page"
      />
    );
  }
  return (
    <AppColumnHeader
      title={title}
      // The chat (or Start Work) comes back beside the page, with or without an open chat.
      layoutAction={canShowChat ? 'restore-split' : undefined}
      layoutActionLabel="Show the chat beside the page"
      onLayoutAction={onRestoreSplit}
      onClose={closePage}
      closeLabel="Close page"
    />
  );
}
