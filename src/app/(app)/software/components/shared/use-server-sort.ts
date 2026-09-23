'use client';

import type { DataTableSortState } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { SortDirection } from '@/generated/schema-enums';

interface ServerSortInput {
  field: string;
  direction: SortDirection;
}

interface ServerSort {
  /** What the query sends — referentially stable while the URL holds still. */
  sort: ServerSortInput | null;
  /** What the header draws its indicator from. */
  sortState: DataTableSortState | null;
  /** The header's click. */
  onSortChange: (columnId: string) => void;
}

interface UseServerSortOptions {
  /** The URL's sort field and direction, as `useApiParams` reads them (direction defaults to `'desc'`). */
  sortBy: string;
  sortDir: string;
  /** Column ids the backend sorts by. They double as `SortInput.field`, so the header and the query agree. */
  sortableIds: readonly string[];
  /** Writes both params; `''` drops one from the URL. */
  onChange: (sortBy: string, sortDir: string) => void;
}

/**
 * A Software table's server-side sort, kept in the URL: what the query sends,
 * what the header draws, and the header's click.
 */
export function useServerSort({ sortBy: urlSortBy, sortDir, sortableIds, onChange }: UseServerSortOptions): ServerSort {
  // The URL is user input: a hand-edited or stale field would otherwise travel
  // straight into `SortInput.field` and surface as a GraphQL error inside the
  // Suspense boundary, with no way back from the page.
  const sortBy = sortableIds.includes(urlSortBy) ? urlSortBy : '';
  const desc = sortDir !== 'asc';

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references.
  const sort = useMemo<ServerSortInput | null>(
    () => (sortBy ? { field: sortBy, direction: desc ? SortDirection.DESC : SortDirection.ASC } : null),
    [sortBy, desc],
  );

  // What the header draws its indicator from — live, so it flips on click while
  // the deferred query catches up.
  const sortState: DataTableSortState | null = sortBy ? { id: sortBy, desc } : null;

  // The header's 3-state toggle: unsorted → desc → asc → unsorted. The default
  // direction is written as `''`, not `'desc'`: `useApiParams` drops a param
  // only when it is empty, never by comparing with its default, so `'desc'`
  // would leave a stale `?sortDir=desc` on an unsorted list.
  const onSortChange = (columnId: string) => {
    if (sortBy !== columnId) onChange(columnId, '');
    else if (desc) onChange(columnId, 'asc');
    else onChange('', '');
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  };

  return { sort, sortState, onSortChange };
}
