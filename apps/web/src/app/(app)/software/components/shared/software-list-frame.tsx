'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, type DataTableSortState, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useMemo, useState } from 'react';
import { NO_ITEMS } from '@/app/components/shared';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS, type PagedListId } from '@/lib/paged-lists';
import { FLEET_SEARCH_DEBOUNCE_MS } from './fleet-list-paging';
import { type ServerSortInput, useServerSort } from './use-server-sort';

/** Every funnel's selection, keyed by its column id. */
export type ListSelections = Readonly<Record<string, readonly string[]>>;

/** What the frame hands the list it frames — the query's inputs and the header's controls. */
export interface SoftwareListFrameRenderProps {
  /** Deferred — feeds the query (lags the box during a refetch). */
  debouncedSearch: string;
  /** Deferred — feeds the query (lags the indicator during a refetch). */
  sort: ServerSortInput | null;
  /** Deferred — feeds the query (lags the ticks during a refetch). */
  deferredSelections: ListSelections;
  /** Live — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /** Live — what the funnels draw as ticked, so a tick lands instantly. */
  selections: ListSelections;
  /** A partial `next` keeps the funnels it does not name. */
  onSelectionsChange: (next: Partial<Record<string, string[]>>) => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** Nothing in the list at all (not a search or funnel miss) — the frame drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The narrow content area's filter window is open (`filterModal`): the list draws it, with the options it read. */
  filtersOpen: boolean;
  onFiltersClose: () => void;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The URL prefix of this list's params (its auto-refresh interval sits beside them). */
  paramPrefix: string;
}

interface SoftwareListFrameProps {
  /**
   * Prefix for the URL params the frame keeps (`search`, `sortBy`, `sortDir`
   * and one per funnel). A page owns the plain names; a tab that shares its
   * URL with other tabs prefixes them (`cveSearch`, `cveSortBy`, …) so two
   * lists never fight over one param.
   */
  paramPrefix?: string;
  /**
   * The pager: rows per page, and which list it pages (`PAGED_LISTS`: what the list's API can do for the pager, server
   * Prev and a reliable `hasPreviousPage`).
   */
  paging: { pageSize: number; list: PagedListId };
  placeholder: string;
  /** Column ids the surface's connection sorts by — the toggles drawn. Omit for a list with no sort. */
  sortableIds?: readonly string[];
  /** Column ids that carry a funnel — each keeps its selection in the URL under its own name. */
  filterKeys?: readonly string[];
  /**
   * The module's flag has not answered yet: the toolbar draws locked, and the rows draw in a loading scope, where
   * the list component draws its own loading state and does not fetch.
   */
  loading?: boolean;
  /**
   * The funnels again, for a narrow content area where the columns that carry them are hidden: a filter button beside
   * the search opens the list's filter window (`filtersOpen`), which the list draws with the options it read.
   */
  filterModal?: boolean;
  /** Above the toolbar while the list has rows — a device tab's sync banner. */
  banner?: ReactNode;
  className?: string;
  children: (list: SoftwareListFrameRenderProps) => ReactNode;
}

/**
 * The schema below is built from names, so the params come back untyped by
 * key; each read narrows to the type its declaration promises.
 */
function readString(params: Readonly<Record<string, unknown>>, key: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

function readArray(params: Readonly<Record<string, unknown>>, key: string): string[] {
  const value = params[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * The frame every Software module list sits in — the fleet-wide Software and
 * Vulnerabilities pages, and the device tabs that show the same nodes. It owns
 * what is the same on all of them: the URL state (search, server sort and the
 * funnels' selections), the sticky search bar, the deferred query variables,
 * the rows' loading state before they answer and the toolbar's retreat when there is
 * nothing to search. The child renders the rows and owns the connection they
 * come from — and how the selections become that connection's filter input.
 *
 * One frame is what keeps a device tab identical to its page: the pages are
 * the reference, and a tab that draws its own toolbar or keeps its search in
 * local state has already drifted.
 */
export function SoftwareListFrame({
  paramPrefix = '',
  paging,
  placeholder,
  sortableIds = NO_ITEMS,
  filterKeys = NO_ITEMS,
  loading = false,
  filterModal = false,
  banner,
  className,
  children,
}: SoftwareListFrameProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchKey = 'search';
  const sortByKey = 'sortBy';
  const sortDirKey = 'sortDir';

  // The list's own params under its prefix (`cveSearch`, `cveSortBy`, …). A change to any of them drops the pager's
  // cursor in the SAME URL write (one history entry on page 2+, so Back returns to the old view).
  const { params, setParam, setParams } = useApiParams(
    {
      [searchKey]: { type: 'string', default: '' },
      [sortByKey]: { type: 'string', default: '' },
      [sortDirKey]: { type: 'string', default: 'desc' },
      ...Object.fromEntries(filterKeys.map(key => [key, { type: 'array', default: [] }])),
    },
    { prefix: paramPrefix, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    prefix: paramPrefix,
    pageSize: paging.pageSize,
    ...PAGED_LISTS[paging.list],
    resetOn: JSON.stringify(params),
  });

  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    readString(params, searchKey),
    value => setParam(searchKey, value),
    FLEET_SEARCH_DEBOUNCE_MS,
  );

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const { sort, sortState, onSortChange } = useServerSort({
    sortBy: readString(params, sortByKey),
    sortDir: readString(params, sortDirKey),
    sortableIds,
    onChange: (sortBy, sortDir) => setParams({ [sortByKey]: sortBy, [sortDirKey]: sortDir }),
  });

  // Memoized for identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references, and `params` is stable per value.
  const selections = useMemo<ListSelections>(
    () => Object.fromEntries(filterKeys.map(key => [key, readArray(params, key)])),
    [filterKeys, params],
  );
  // Every funnel is written back at once, so the URL never holds a stale one —
  // but from the CURRENT selection, not from empty: a caller that names one
  // funnel must not wipe the others.
  const onSelectionsChange = (next: Partial<Record<string, string[]>>) =>
    setParams(Object.fromEntries(filterKeys.map(key => [key, next[key] ?? [...(selections[key] ?? [])]])));

  // Sort and the funnels travel as one deferred object so the query lags in
  // lockstep with the search and `isPending` covers all three. The query reads the search from the URL, not the
  // box's debounced value: the URL write that carries a new search drops the cursor in the same navigation, so the two
  // can never meet in one request (the box's value runs ahead of the URL by one commit).
  const narrowing = useMemo(() => ({ sort, selections }), [sort, selections]);
  const {
    deferredFilters: deferredNarrowing,
    deferredSearch,
    deferredPage,
    isPending,
  } = useDeferredQuery(narrowing, readString(params, searchKey), pager.variables);

  const list: SoftwareListFrameRenderProps = {
    debouncedSearch: deferredSearch,
    sort: deferredNarrowing.sort,
    deferredSelections: deferredNarrowing.selections,
    sortState,
    onSortChange,
    selections,
    onSelectionsChange,
    isPending,
    onEmptyChange: setIsEmpty,
    stickyHeaderOffset,
    filtersOpen,
    onFiltersClose: () => setFiltersOpen(false),
    pager,
    pageVariables: deferredPage,
    paramPrefix,
  };

  return (
    <div className={cn('flex flex-col', className)} style={containerStyle}>
      {/* The banner keeps its own bottom margin: the pinned toolbar's negative top
          margin eats exactly that, instead of the banner's last rows. */}
      {!isEmpty && banner}
      {!isEmpty && (
        <SearchToolbar
          toolbarRef={toolbarRef}
          placeholder={placeholder}
          value={searchInput}
          onChange={setSearchInput}
          disabled={loading}
          actions={
            filterModal && (
              <Button
                variant="outline"
                size="icon"
                className="content-md:hidden"
                onClick={() => setFiltersOpen(true)}
                disabled={loading}
                aria-label="Open filters"
                leftIcon={<Filter02Icon className="text-ods-text-primary" />}
              />
            )
          }
        />
      )}

      {/* The rows before they answer, the same for a query in flight (the list's own boundary) and for the flag's own
          window: the list itself, in a loading scope, where it draws its own loading state and does not fetch. */}
      {/* The list wraps its query in a StaleCursorBoundary itself, inside whatever ContentErrorBoundary it has. */}
      <LoadingWhen loading={loading}>{children(list)}</LoadingWhen>
    </div>
  );
}
