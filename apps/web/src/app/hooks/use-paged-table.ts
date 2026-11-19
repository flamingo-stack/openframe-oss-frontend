'use client';

import type {
  CursorPageInfo,
  CursorPagerFooterProps,
  UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect } from 'react';
import { useAutoRefresh, type UseAutoRefreshReturn } from './use-auto-refresh';

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
}: UsePagedTableOptions): UsePagedTableReturn {
  const stale = pager.isStale(pageInfo, rowCount);
  const { dropCursor } = pager;
  useEffect(() => {
    if (stale) dropCursor();
  }, [stale, dropCursor]);

  const { control } = useAutoRefresh({ prefix, refetch });

  return { pager: pager.footerProps(pageInfo), refresh: control };
}
