'use client';

import { DataTable, type useDataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { InfiniteScroll } from '@/app/components/shared';
import { KNOWLEDGE_BASE_PAGE_SIZE } from './knowledge-base-item-columns';

/** The connections a row's dialog marks stale, before a listing has answered: none. */
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

interface KnowledgeBaseTableProps<T> {
  table: ReturnType<typeof useDataTable<T>>;
  /** The rows on screen: the infinite footer is drawn once there is a first page. */
  rowCount: number;
  totalCount: number;
  /** What a row is called in the count ("article", "item"). */
  itemName: string;
  /** The row the body draws when the listing finds nothing. */
  emptyTitle: string;
  rowHref: (row: T) => string;
  infiniteScroll: InfiniteScroll;
  /** A refetch is in flight and the rows on screen are the previous result: they are dimmed, not unmounted. */
  isPending: boolean;
  stickyHeaderOffset: string;
}

/**
 * The table of every knowledge base listing (a level, the archive, a record's assigned articles): the sticky header
 * with the row count, the body (in a loading scope a full page of skeleton rows) and the infinite footer.
 */
export function KnowledgeBaseTable<T>({
  table,
  rowCount,
  totalCount,
  itemName,
  emptyTitle,
  rowHref,
  infiniteScroll,
  isPending,
  stickyHeaderOffset,
}: KnowledgeBaseTableProps<T>) {
  return (
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName={itemName} totalCount={totalCount} />}
        />
        <DataTable.Body
          skeletonRows={KNOWLEDGE_BASE_PAGE_SIZE}
          emptyState={{ title: emptyTitle }}
          rowClassName="mb-1"
          rowHref={rowHref}
        />
        {rowCount > 0 && <DataTable.InfiniteFooter {...infiniteScroll} skeletonRows={KNOWLEDGE_BASE_PAGE_SIZE} />}
      </DataTable>
    </div>
  );
}
