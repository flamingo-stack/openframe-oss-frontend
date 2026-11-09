'use client';

import {
  AppColumnHeader,
  type AppLayoutWorkAreaMode,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { useMingoChat, useMingoChatThreadOnScreen } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { type ComposerRoute, composerRouteOf, isSheetRoute } from '@/app/components/mingo-shell/mingo-dock-route';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { navModuleOf, navModuleSectionedLabel } from '@/lib/navigation-config';
import { routes, withMingoDialog } from '@/lib/routes';
import { shownChatViewOf, useManhattanCentreStore, workAreaModeOf } from './manhattan-centre-store';
import { ManhattanComposerPortal, ManhattanComposerSlot } from './manhattan-composer-host';
import { ManhattanDockContext } from './manhattan-dock-context';

/** What the Manhattan v2 centre hands `AppLayout` (`chatColumn`, `workAreaMode`, `pageHeader`, the dock). */
export interface ManhattanCentreSlots {
  mode: AppLayoutWorkAreaMode;
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
 * The Manhattan v2 centre (flag `manhattan-v2`): the chat column and the page column of
 * `AppLayout`'s work area, which shows when (plan D5, table T), and their headers (matrix H).
 * Mounted unconditionally around the layout inside `MingoChatProvider` (it reads the open
 * chat) and told whether it is on through `enabled`; off, it hands `null` and the
 * Mingo-first shell renders exactly as before.
 */
export function ManhattanCentre({
  enabled,
  compact = false,
  children,
}: {
  enabled: boolean;
  /** No room for two columns (`ManhattanSqueeze.compact`): one column, the sidebars as drawers. */
  compact?: boolean;
  children: (centre: ManhattanCentreSlots | null) => ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = composerRouteOf(pathname);
  const { chat } = useMingoChat();
  const openDialogId = chat?.state.activeDialogId ?? null;
  const chatView = useManhattanCentreStore(s => s.chatView);
  const setChatView = useManhattanCentreStore(s => s.setChatView);
  const oneColumn = enabled && compact;
  // A phone: the page alone (its chats are their pages, its list the top bar's Mingo button).
  const phone = useMdUp() === false;
  const mode = workAreaModeOf(route, openDialogId !== null, chatView, oneColumn, phone);

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

  // A page picked while the chat was full over the last one is shown, beside the chat; in
  // one column (compact) the page is shown and the chat waits behind it.
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    if (!enabled || previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    if (route !== 'page' && route !== 'full-width') return;
    if (oneColumn) {
      if (chatView !== 'hidden') setChatView('hidden');
    } else if (chatView === 'full' && route === 'page') setChatView('split');
  }, [enabled, oneColumn, pathname, route, chatView, setChatView]);

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
        pageHidden: mode === 'chat',
        chatColumn: <ManhattanChatColumn shown={mode !== 'page'} onScreen={mode !== 'page' && openDialogId !== null} />,
        // Only beside a chat column: in one column (compact) and on a phone the top bar is the
        // page's chrome, and there is no other column to go full screen over or close back to.
        pageHeader:
          oneColumn || phone ? null : (
            <ManhattanPageHeader
              route={route}
              pathname={pathname}
              mode={mode}
              openDialogId={openDialogId}
              onFullScreen={() => setChatView('hidden')}
              onRestoreSplit={() => setChatView(shownChatViewOf(route))}
              onShowChat={() => {
                showChatOnArrivalRef.current = true;
              }}
            />
          ),
        wrapDock: dock => (
          <>
            <ManhattanComposerPortal>{dock}</ManhattanComposerPortal>
            <ManhattanComposerSlot active={mode === 'page'} />
          </>
        ),
        // Start Work is a page of blocks ("Needs you"), not a centred greeting: the dock lies
        // over its end and the page fades out under it, as on the Mingo-first dashboard.
        dockFloats: floats => mode === 'page' && (floats || route === 'home'),
      }
    : null;

  return <ManhattanDockContext.Provider value={enabled}>{children(slots)}</ManhattanDockContext.Provider>;
}

/**
 * The chat column: the node the session's chat portals its header and thread into, and
 * under it the composer's place while the column is on screen.
 */
function ManhattanChatColumn({ shown, onScreen }: { shown: boolean; onScreen: boolean }) {
  const setThreadNode = useManhattanCentreStore(s => s.setThreadNode);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-ods-bg">
      {onScreen && <ThreadOnScreen />}
      <div ref={setThreadNode} data-testid="manhattan-chat-thread" className="flex min-h-0 flex-1 flex-col" />
      {/* The composer spans the column (the dock's max width is for under a page). */}
      <ManhattanComposerSlot active={shown} className="shrink-0 px-[var(--spacing-system-lf)] [&_section]:max-w-none" />
    </div>
  );
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
  onFullScreen: () => void;
  onRestoreSplit: () => void;
  /** "Close page" with a chat waiting behind: it no longer waits (`chatView` back to `split` once its page is up). */
  onShowChat: () => void;
}

/**
 * The page column's header (plan matrix H): Start Work's title alone; on a page its
 * module's name, then in split "Full screen" (the chat waits behind the page) and
 * "Close page" (the chat alone, on its page), alone "Show side by side" while a chat
 * waits and "Close page" (that chat on its page; Start Work when no chat is open). A
 * chat's own page draws none: the chat's header is its header.
 */
function ManhattanPageHeader({
  route,
  pathname,
  mode,
  openDialogId,
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
      layoutAction={openDialogId ? 'restore-split' : undefined}
      layoutActionLabel="Show the chat beside the page"
      onLayoutAction={onRestoreSplit}
      onClose={closePage}
      closeLabel="Close page"
    />
  );
}
