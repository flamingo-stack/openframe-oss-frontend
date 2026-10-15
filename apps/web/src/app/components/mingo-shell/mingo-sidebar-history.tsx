'use client';

import {
  ArchiveChatModal,
  type DialogItem,
  MingoChatRail,
  RenameChatModal,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { routes } from '@/lib/routes';
import { useHistorySearchStore } from './history-search-store';

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
 * is someone else's), paging with no cap, the working / approval glyphs — grouped by
 * the day each chat was created (the dialogs carry no last-activity time).
 *
 * A row opens its chat page, which selects it; the selected chat stays highlighted on
 * every page. Row ⋯ is Rename / Copy link / Archive — Compact lives in the composer —
 * through the same modals, mutations and toasts as the chat's own menus; archiving
 * the open chat drops it, which takes its chat page home. The search field's open
 * state is shared with the shell, which opens it on ⌘K / Ctrl+K.
 */
export function MingoSidebarHistory() {
  const { chat, error, enabled, copyDialogLink } = useMingoChat();
  const searchOpen = useHistorySearchStore(s => s.open);
  const setSearchOpen = useHistorySearchStore(s => s.setOpen);
  const router = useRouter();
  const [renameTarget, setRenameTarget] = useState<DialogItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DialogItem | null>(null);
  // The modals render over the window, outside the sidebar: a drawer that slides
  // the sidebar in (a transform) would otherwise become their containing block.
  const canPortal = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  if (!enabled) return null;
  // The state's first pass, before the dock has registered — or it crashed, which
  // no retry here can restart.
  if (!chat)
    return <MingoChatRail variant="section" dialogs={NO_DIALOGS} isLoadingHistory={!error} loadError={!!error} />;

  const { state } = chat;
  const loading = state.isDialogsLoading;

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
        onSelectDialog={id => router.push(routes.mingo.chat(id))}
        statusOf={chat.dialogStatusOf}
        ownedByOther={chat.dialogOwnedByOther}
        onRequestRename={setRenameTarget}
        onRequestCopyLink={dialog => void copyDialogLink(dialog)}
        onRequestArchive={setArchiveTarget}
        onOpenArchive={() => router.push(routes.mingo.archive)}
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
        onLoadMore={() => void state.loadMoreDialogs()}
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
}: {
  renameTarget: DialogItem | null;
  onCloseRename: () => void;
  onConfirmRename: (title: string) => void;
  archiveTarget: DialogItem | null;
  onCloseArchive: () => void;
  onConfirmArchive: () => void;
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
    </>
  );
}
