'use client';

import type {
  CursorPageInfo,
  CursorPagerFooterProps,
  CursorPagerVariables,
  UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect } from 'react';
import { useAutoRefresh, type UseAutoRefreshReturn } from './use-auto-refresh';

/** Where a paged list stands: what the view that owns its URL hands the table that reads the page, as one prop. */
export interface PagedListPosition {
  /** The URL's pager (`useCursorPager`): the footer props, the stale check and the cursor drop. */
  pager: UseCursorPagerReturn;
  /**
   * The deferred page variables the query spreads (`useDeferredQuery`'s `deferredPage`): they lag the URL while the
   * next page is read, so the page on screen stays.
   */
  pageVariables: CursorPagerVariables;
  /** The URL prefix the list's params carry, its auto-refresh interval among them; none where the view owns the URL. */
  paramPrefix?: string;
}

interface UsePagedTableOptions {
  pager: UseCursorPagerReturn;
  /** The page's `pageInfo` as it came back. */
  pageInfo: CursorPageInfo | null | undefined;
  /** Rows on the page as it came back. */
  rowCount: number;
  /** The table's URL prefix (its auto-refresh interval sits beside its filters). */
  prefix?: string;
  /** Refetch the page on screen silently (`useRefetchPage`): the auto-refresh tick. */
  refetch: () => Promise<unknown>;
  /**
   * The rows on screen are the previous variables' (a deferred refetch is in flight): they say nothing about the
   * URL's cursor yet, so the stale check waits.
   */
  isPending?: boolean;
}

interface UsePagedTableReturn {
  /** `LiveTable`'s `pager`. */
  pager: CursorPagerFooterProps;
  /** `LiveTable`'s `refresh`. */
  refresh: UseAutoRefreshReturn['control'];
}

/**
 * The parts every paged Relay table wires the same way, from the page that came back: the footer, the auto-refresh
 * picker and its timer, and the drop of a cursor the server ignored (an empty page 2+, or a page that says it has
 * nothing before it on a list whose `hasPreviousPage` is reliable). A cursor the server refused with an error is
 * `StaleCursorBoundary`'s.
 */
export function usePagedTable({
  pager,
  pageInfo,
  rowCount,
  prefix,
  refetch,
  isPending = false,
}: UsePagedTableOptions): UsePagedTableReturn {
  const stale = !isPending && pager.isStale(pageInfo, rowCount);
  const { dropCursor } = pager;
  useEffect(() => {
    if (stale) dropCursor();
  }, [stale, dropCursor]);

  const { control } = useAutoRefresh({ prefix, refetch });

  return { pager: pager.footerProps(pageInfo), refresh: control };
}
