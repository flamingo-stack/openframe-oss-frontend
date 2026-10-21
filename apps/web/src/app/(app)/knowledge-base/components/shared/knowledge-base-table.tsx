'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { InfiniteScroll } from '@/app/components/shared';
import { KNOWLEDGE_BASE_PAGE_SIZE } from './knowledge-base-item-columns';

/** The connections a row's dialog marks stale when it is given none (a listing that has not answered): none. */
export const NO_LISTING_IDS: readonly string[] = [];

/**
 * The infinite scroll of a knowledge base listing: the next page of `KNOWLEDGE_BASE_PAGE_SIZE`, with a toast when it
 * cannot be read (`errorTitle`).
 */
export function useKnowledgeBaseLoadMore(
  {
    loadNext,
    hasNext,
    isLoadingNext,
  }: {
    loadNext: (count: number, options: { onComplete: (error: Error | null) => void }) => unknown;
    hasNext: boolean;
    isLoadingNext: boolean;
  },
  errorTitle: string,
): InfiniteScroll {
  const { toast } = useToast();
  const onLoadMore = () => {
    if (!hasNext || isLoadingNext) return;
    loadNext(KNOWLEDGE_BASE_PAGE_SIZE, {
      onComplete: error => {
        if (error) toast({ title: errorTitle, description: error.message, variant: 'destructive' });
      },
    });
  };
  return { hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore };
}
