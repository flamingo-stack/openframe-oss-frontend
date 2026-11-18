'use client';

import { type DialogItem, MingoHistoryRail } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useRouter } from 'next/navigation';
import { MINGO_DIALOGS_PAGE_SIZE } from '@/app/(app)/mingo/hooks/use-mingo-unified-chat-state';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { routes } from '@/lib/routes';
import { useMingoSheetStore } from './mingo-sheet-store';

const NO_DIALOGS: DialogItem[] = [];

/**
 * A phone's chat list, what the top bar's Mingo button opens over the page (in the
 * sheet, `MingoComposerSheet`): the classic drawer's first screen, the lib's
 * `MingoHistoryRail` - "Start New Chat", My / All Chats, the chats - over the session's
 * chat state (`useMingoChat`, read only, as the sidebar's history reads it). A chat opens
 * on its page and "Start New Chat" on Mingo's home, about the page under the list: on a
 * phone a chat takes the screen.
 */
export function MingoPhoneChatList() {
  const { chat, error } = useMingoChat();
  const router = useRouter();
  const rememberNewChatPage = useMingoSheetStore(s => s.rememberNewChatPage);
  // A pick puts the list away at once, also for the chat already on screen (no navigation to close it).
  const hideList = useMingoSheetStore(s => s.hideList);

  if (!chat) return <MingoHistoryRail dialogs={NO_DIALOGS} isLoadingHistory={!error} loadError={!!error} />;

  const { state } = chat;
  const loading = state.isDialogsLoading;
  // Out of `state` before a callback closes over it: `state` is new with every streamed chunk.
  const { loadMoreDialogs } = state;

  return (
    <MingoHistoryRail
      dialogs={state.dialogs}
      activeDialogId={state.activeDialogId ?? undefined}
      onSelectDialog={id => {
        hideList();
        router.push(routes.mingo.chat(id));
      }}
      onNewChat={() => {
        rememberNewChatPage();
        hideList();
        router.push(routes.mingo.home);
      }}
      onRequestCopyLink={state.dialogCapabilities?.onCopyLink}
      scope={state.dialogScope}
      onScopeChange={state.setDialogScope}
      searchQuery={state.dialogCapabilities?.searchQuery}
      hasMore={state.hasMoreDialogs}
      // One loading flag for the first page and the next ones: rows on screen mean a next page.
      isLoadingMore={loading && state.dialogs.length > 0}
      isLoadingHistory={loading && state.dialogs.length === 0}
      onLoadMore={() => void loadMoreDialogs()}
      // A page (20) at a time, on "Show more", as the sidebar's history: the list is the
      // session's, and pages a scroll chained in showed everywhere.
      loadMore="button"
      pageSize={MINGO_DIALOGS_PAGE_SIZE}
      loadError={state.dialogsError && state.dialogs.length === 0}
      onRetry={state.reloadDialogs}
    />
  );
}
