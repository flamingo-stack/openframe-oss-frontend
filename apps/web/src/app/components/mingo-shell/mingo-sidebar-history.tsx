'use client';

import {
  ArchiveChatModal,
  type DialogItem,
  MingoChatRail,
  MingoChatSearchModal,
  RenameChatModal,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ChatsIcon, Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NavigationSidebarActionRow } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { routes } from '@/lib/routes';
import { openMingoDialog } from '../notifications/open-mingo-dialog';
import { ResetOnboardingDialog, useCanResetOnboarding } from '../reset-onboarding-dialog';
import { useChatPageNodeStore } from './chat-page-node-store';
import { useHistorySearchStore } from './history-search-store';
import { MingoNewChatRow } from './mingo-new-chat-row';
import { closeMobileMenu } from './mobile-menu-store';

const NO_DIALOGS: DialogItem[] = [];
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Chat history section of the Mingo-first sidebar (`sectionSlot`): the lib's
 * `MingoChatRail variant="section"` over the session's chat state.
 *
 * It only READS the state (`useMingoChat`): the composer dock is the surface that
 * keeps it running, so the list, its 60 s refresh and the live row status are the
 * session's, not a second copy. What it shows is the drawer's list as it is today —
 * active chats only, server search, My / All Chats (flipping to All when the open chat
 * is someone else's), paging with no cap, the working / approval glyphs — the chat
 * with the latest message first, grouped by the day of that message.
 *
 * A row opens its chat in the sheet over the page (on the chat page, in its place); the
 * selected chat stays highlighted on every page. Row ⋯ is Rename / Copy link / Archive — Compact is in the open chat's ⋯ —
 * through the same modals, mutations and toasts as the chat's own menus; archiving
 * the open chat drops it, which takes its chat page home. The history's ⋯ also offers
 * "Reset Onboarding" (onboarding v2), as the chat's ⋯ does. The search is a modal,
 * `MingoHistorySearch` below, drawn once by the shell; its open state is shared with
 * the shell, which opens it on ⌘K / Ctrl+K.
 */
export function MingoSidebarHistory() {
  const { chat, error, enabled, copyDialogLink } = useMingoChat();
  const currentUserId = useAuthStore(s => s.user?.id ?? null);
  const searchOpen = useHistorySearchStore(s => s.open);
  const setSearchOpen = useHistorySearchStore(s => s.setOpen);
  const router = useRouter();
  const [renameTarget, setRenameTarget] = useState<DialogItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DialogItem | null>(null);
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  const canResetOnboarding = useCanResetOnboarding() && onboardingV2 === 'on';
  const [resetOnboardingOpen, setResetOnboardingOpen] = useState(false);
  // The modals render over the window, outside the sidebar: a drawer that slides
  // the sidebar in (a transform) would otherwise become their containing block.
  const canPortal = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  if (!enabled) return null;
  // The state's first pass, before the dock has registered — or it crashed, which
  // no retry here can restart.
  // The search is controlled from the first pass: switching it from uncontrolled
  // once the state registers is a React warning.
  if (!chat)
    return (
      <MingoChatRail
        variant="section"
        dialogs={NO_DIALOGS}
        isLoadingHistory={!error}
        loadError={!!error}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
      />
    );

  const { state } = chat;
  const loading = state.isDialogsLoading;
  // Out of `state` before a callback closes over it: `state` is new with every
  // streamed chunk, and a rail prop keyed on it re-rendered every row per chunk.
  const { loadMoreDialogs } = state;
  // In the phone drawer a navigation closes it (the layout watches the location), but
  // the chat already open, or the archive page already on screen, moves nothing.
  const open = (href: string) => {
    closeMobileMenu();
    router.push(href);
  };
  // A chat opens over the page in the sheet, as every chat does at first ("Open as
  // full chat" takes it to its page); on the chat page, in its place.
  const openChat = (id: string) => {
    closeMobileMenu();
    openMingoDialog(id, { navigate: href => router.push(href) });
  };

  const confirmRename = (title: string) => {
    if (renameTarget) void state.renameDialog(renameTarget.id, title);
    setRenameTarget(null);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const wasOpen = archiveTarget.id === state.activeDialogId;
    try {
      await state.archiveDialog(archiveTarget.id);
    } catch {
      // Toasted by the mutation; the modal stays open for a retry.
      return;
    }
    // As the chat's own ⋯ does: the archived chat is no longer the open one.
    if (wasOpen) state.clearMessages();
    setArchiveTarget(null);
  };

  return (
    <>
      <MingoChatRail
        variant="section"
        dialogs={state.dialogs}
        activeDialogId={state.activeDialogId ?? undefined}
        onSelectDialog={openChat}
        statusOf={chat.dialogStatusOf}
        // A row whose `owner.id` is not the viewer's shows the owner's initials.
        currentUserId={currentUserId}
        onRequestRename={setRenameTarget}
        onRequestCopyLink={dialog => void copyDialogLink(dialog)}
        onRequestArchive={setArchiveTarget}
        onOpenArchive={() => open(routes.mingo.archive)}
        // The design's "What to ask Mingo?" in the history's ⋯: the suggestions, as the full chat.
        onWhatToAsk={() => useMingoLauncherStore.getState().showWhatToAsk()}
        moreMenuItems={
          canResetOnboarding
            ? [
                {
                  id: 'reset-onboarding',
                  label: 'Reset Onboarding',
                  icon: <Refresh01RightIcon className="h-full w-full text-ods-text-secondary" />,
                  onClick: () => setResetOnboardingOpen(true),
                },
              ]
            : undefined
        }
        scope={state.dialogScope}
        onScopeChange={state.setDialogScope}
        searchQuery={chat.searchQuery}
        onSearchChange={chat.setSearchQuery}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        hasMore={state.hasMoreDialogs}
        // One loading flag for the first page and the next ones (see the state):
        // rows on screen mean it is a next page.
        isLoadingMore={loading && state.dialogs.length > 0}
        isLoadingHistory={loading && state.dialogs.length === 0}
        onLoadMore={() => void loadMoreDialogs()}
        // A page (20) at a time, on "Show more" at the end of the list.
        loadMore="button"
        loadError={chat.dialogsLoadFailed && state.dialogs.length === 0}
        onRetry={state.reloadDialogs}
      />
      {canPortal &&
        createPortal(
          <SidebarHistoryModals
            renameTarget={renameTarget}
            onCloseRename={() => setRenameTarget(null)}
            onConfirmRename={confirmRename}
            archiveTarget={archiveTarget}
            onCloseArchive={() => setArchiveTarget(null)}
            onConfirmArchive={() => void confirmArchive()}
            resetOnboardingOpen={resetOnboardingOpen}
            onResetOnboardingOpenChange={setResetOnboardingOpen}
            // The tour starts over from the wizard's "Start with Mingo", as from the chat's ⋯.
            onResetOnboarding={() => open(routes.setup)}
          />,
          document.body,
        )}
    </>
  );
}

function SidebarHistoryModals({
  renameTarget,
  onCloseRename,
  onConfirmRename,
  archiveTarget,
  onCloseArchive,
  onConfirmArchive,
  resetOnboardingOpen,
  onResetOnboardingOpenChange,
  onResetOnboarding,
}: {
  renameTarget: DialogItem | null;
  onCloseRename: () => void;
  onConfirmRename: (title: string) => void;
  archiveTarget: DialogItem | null;
  onCloseArchive: () => void;
  onConfirmArchive: () => void;
  resetOnboardingOpen: boolean;
  onResetOnboardingOpenChange: (open: boolean) => void;
  onResetOnboarding: () => void;
}) {
  return (
    <>
      <RenameChatModal
        isOpen={renameTarget != null}
        initialName={renameTarget?.title ?? ''}
        onClose={onCloseRename}
        onSave={onConfirmRename}
      />
      <ArchiveChatModal isOpen={archiveTarget != null} onClose={onCloseArchive} onConfirm={onConfirmArchive} />
      <ResetOnboardingDialog
        open={resetOnboardingOpen}
        onOpenChange={onResetOnboardingOpenChange}
        onReset={onResetOnboarding}
      />
    </>
  );
}

/**
 * The chats' place in the sidebar (`sectionSlot`): "New chat" at their head, then the
 * history section from 140px of width up, and in the 56px rail a "Chats" row that
 * opens the chat search — the whole history by day, and its search. Both stay mounted
 * and the width decides, as for every row; a function slot, so the sidebar leaves the
 * rail to it. The row is lit while a chat page is up (it publishes its node), the one
 * place the rail has nothing else lit.
 */
export function MingoSidebarHistorySlot({ minimized }: { minimized: boolean }) {
  const onChatPage = useChatPageNodeStore(s => s.node !== null);
  const setSearchOpen = useHistorySearchStore(s => s.setOpen);
  return (
    // Rows apart as in the tree; the section's caption a step further from New chat.
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] @[140px]/of-nav-sidebar:gap-[var(--spacing-system-sf)]">
      <MingoNewChatRow minimized={minimized} />
      <div className="flex flex-col @[140px]/of-nav-sidebar:hidden">
        <NavigationSidebarActionRow
          icon={<ChatsIcon />}
          label="Chats"
          active={onChatPage}
          minimized={minimized}
          onClick={() => setSearchOpen(true)}
        />
      </div>
      <div className="hidden flex-col duration-300 animate-in fade-in @[140px]/of-nav-sidebar:flex motion-reduce:animate-none">
        <MingoSidebarHistory />
      </div>
    </div>
  );
}

/**
 * The history's search (`MingoChatSearchModal`), once for the page: the sidebar
 * section is drawn twice (the sidebar and the phone drawer) and leaves the modal to
 * its host, which opens it from either one's Search, or on ⌘K / Ctrl+K. Picking a
 * chat opens it as a row does.
 */
export function MingoHistorySearch() {
  const { chat, enabled } = useMingoChat();
  const currentUserId = useAuthStore(s => s.user?.id ?? null);
  const searchOpen = useHistorySearchStore(s => s.open);
  const setSearchOpen = useHistorySearchStore(s => s.setOpen);
  const router = useRouter();

  if (!enabled || !chat) return null;
  const { state } = chat;
  const loading = state.isDialogsLoading;
  // As in the section: not keyed on `state`, which is new with every streamed chunk.
  const { loadMoreDialogs } = state;
  return (
    <MingoChatSearchModal
      open={searchOpen}
      onOpenChange={setSearchOpen}
      dialogs={state.dialogs}
      activeDialogId={state.activeDialogId ?? undefined}
      statusOf={chat.dialogStatusOf}
      currentUserId={currentUserId}
      searchQuery={chat.searchQuery}
      onSearchChange={chat.setSearchQuery}
      onSelectDialog={id => {
        closeMobileMenu();
        openMingoDialog(id, { navigate: href => router.push(href) });
      }}
      hasMore={state.hasMoreDialogs}
      isLoadingMore={loading && state.dialogs.length > 0}
      isLoadingHistory={loading && state.dialogs.length === 0}
      onLoadMore={() => void loadMoreDialogs()}
      loadError={chat.dialogsLoadFailed && state.dialogs.length === 0}
      onRetry={state.reloadDialogs}
    />
  );
}
