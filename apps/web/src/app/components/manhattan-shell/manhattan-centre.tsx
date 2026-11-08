'use client';

import {
  AppColumnHeader,
  type AppLayoutWorkAreaMode,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { useMingoChat, useMingoChatThreadOnScreen } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { type ComposerRoute, composerRouteOf, isSheetRoute } from '@/app/components/mingo-shell/mingo-dock-route';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { navModuleOf, navModuleSectionedLabel } from '@/lib/navigation-config';
import { routes } from '@/lib/routes';
import { shownChatViewOf, useManhattanCentreStore, workAreaModeOf } from './manhattan-centre-store';
import { ManhattanComposerPortal, ManhattanComposerSlot } from './manhattan-composer-host';
import { ManhattanDockContext } from './manhattan-dock-context';

/** What the Manhattan v2 centre hands `AppLayout` (`chatColumn`, `workAreaMode`, `pageHeader`, the dock). */
export interface ManhattanCentreSlots {
  mode: AppLayoutWorkAreaMode;
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
  children,
}: {
  enabled: boolean;
  children: (centre: ManhattanCentreSlots | null) => ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = composerRouteOf(pathname);
  const { chat } = useMingoChat();
  const openDialogId = chat?.state.activeDialogId ?? null;
  const chatView = useManhattanCentreStore(s => s.chatView);
  const setChatView = useManhattanCentreStore(s => s.setChatView);
  const mode = workAreaModeOf(route, openDialogId !== null, chatView);

  // A page picked while the chat was full over the last one is shown, beside the chat.
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    if (!enabled || previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    if (chatView === 'full' && route === 'page') setChatView('split');
  }, [enabled, pathname, route, chatView, setChatView]);

  // The pages the chat goes back beside ("Show side by side" on a chat's page). The
  // Mingo-first shell records them in its sheet, which v2 does not draw.
  const rememberPage = useMingoSheetStore(s => s.rememberPage);
  const rememberOutsidePage = useMingoSheetStore(s => s.rememberOutsidePage);
  useEffect(() => {
    if (!enabled) return;
    const href = search ? `${pathname}?${search}` : pathname;
    if (route !== 'chat') rememberPage(href);
    if (isSheetRoute(route)) rememberOutsidePage(href);
  }, [enabled, pathname, search, route, rememberPage, rememberOutsidePage]);

  const slots: ManhattanCentreSlots | null = enabled
    ? {
        mode,
        chatColumn: <ManhattanChatColumn shown={mode !== 'page'} onScreen={mode !== 'page' && openDialogId !== null} />,
        pageHeader: (
          <ManhattanPageHeader
            route={route}
            pathname={pathname}
            mode={mode}
            openDialogId={openDialogId}
            onFullScreen={() => setChatView('hidden')}
            onRestoreSplit={() => setChatView(shownChatViewOf(route))}
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
      <ManhattanComposerSlot active={shown} className="shrink-0 px-[var(--spacing-system-lf)]" />
    </div>
  );
}

/** The open chat's thread is on screen (its notifications skip the popup and are read on arrival). */
function ThreadOnScreen() {
  useMingoChatThreadOnScreen();
  return null;
}

interface ManhattanPageHeaderProps {
  route: ComposerRoute;
  pathname: string | null;
  mode: AppLayoutWorkAreaMode;
  openDialogId: string | null;
  onFullScreen: () => void;
  onRestoreSplit: () => void;
}

/**
 * The page column's header (plan matrix H): Start Work's title alone; on a page its
 * module's name, then in split "Full screen" (the chat waits behind the page) and
 * "Close page" (the chat alone, on its page), alone "Show side by side" while a chat
 * waits and "Close page" (Start Work). A chat's own page draws none: the chat's header
 * is its header.
 */
function ManhattanPageHeader({
  route,
  pathname,
  mode,
  openDialogId,
  onFullScreen,
  onRestoreSplit,
}: ManhattanPageHeaderProps) {
  const router = useRouter();
  if (route === 'chat') return null;
  if (route === 'home') return <AppColumnHeader title="Start Work" />;
  const moduleId = pathname ? navModuleOf(pathname) : null;
  const title = moduleId ? navModuleSectionedLabel(moduleId) : '';
  if (mode === 'split') {
    const closePage = () => router.push(openDialogId ? routes.mingo.chat(openDialogId) : routes.mingo.home);
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
      onClose={() => router.push(routes.mingo.home)}
      closeLabel="Close page"
    />
  );
}
