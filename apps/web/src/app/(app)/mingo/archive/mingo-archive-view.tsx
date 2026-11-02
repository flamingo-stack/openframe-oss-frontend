'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { ChatArchivePage } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';
import { useMingoDialogActions } from '../hooks/use-mingo-dialog-actions';

/**
 * The archive page's pages of archived chats. Under the `mingo-archived-dialogs`
 * prefix on purpose: archiving and unarchiving a chat invalidate that prefix, so the
 * list is fresh when the reader comes back from a chat they just restored.
 */
const ARCHIVE_PAGE_QUERY_KEY = ['mingo-archived-dialogs', 'archive-page'] as const;
const ARCHIVE_PAGE_SIZE = 20;

/**
 * Archived chats, a page of the Mingo-first shell: the lib's `ChatArchivePage` (its
 * embedded form, under the page's own title) over the archived-dialog fetcher the
 * classic drawer's archive uses, paged as the reader scrolls. Only archived chats are
 * listed. A row opens the chat page, where an archived chat is read-only and its
 * header offers Unarchive (with its confirm). A failed first page is the lib's own
 * load error with Try again.
 */
export function MingoArchiveView() {
  const router = useRouter();
  const { fetchArchivedDialogs } = useMingoDialogActions();
  const archive = useInfiniteQuery({
    queryKey: ARCHIVE_PAGE_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchArchivedDialogs({ cursor: pageParam, limit: ARCHIVE_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
  });
  const dialogs = archive.data?.pages.flatMap(page => page.dialogs) ?? [];

  return (
    <PageLayout
      title="Chat Archive"
      subtitle="Open an archived chat to read it or to unarchive it."
      className="h-full min-h-0 px-[var(--spacing-system-l)]"
      contentClassName="min-h-0"
    >
      <ChatArchivePage
        embedded
        dialogs={dialogs}
        onSelectDialog={id => router.push(routes.mingo.chat(id))}
        // A retry after a failed first page shows the skeleton (it wins over the error).
        isLoading={archive.isPending || archive.isFetchingNextPage || (archive.isError && archive.isFetching)}
        isFetching={archive.isPending}
        hasMore={archive.hasNextPage}
        onLoadMore={() => void archive.fetchNextPage()}
        // "Couldn't load your chats" + Try again, only while nothing is listed: chats
        // already on screen stay there when a later page fails.
        loadError={archive.isError && dialogs.length === 0}
        onRetry={() => void archive.refetch()}
      />
    </PageLayout>
  );
}
