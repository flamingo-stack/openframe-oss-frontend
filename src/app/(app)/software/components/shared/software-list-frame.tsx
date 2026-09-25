'use client';

import type { DataTableSortState } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, Suspense, useMemo, useState } from 'react';
import { TableSkeleton, type TableSkeletonColumn } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareSearchToolbar } from './software-search-toolbar';
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
  onSelectionsChange: (next: Record<string, string[]>) => void;
  /** A refetch is in flight and the rows on screen are the previous result. */
  isPending: boolean;
  /** Nothing in the list at all (not a search or funnel miss) — the frame drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

interface SoftwareListFrameProps {
  /**
   * Prefix for the URL params the frame keeps (`search`, `sortBy`, `sortDir`
   * and one per funnel). A page owns the plain names; a tab that shares its
   * URL with other tabs prefixes them (`cveSearch`, `cveSortBy`, …) so two
   * lists never fight over one param.
   */
  paramPrefix?: string;
  placeholder: string;
  /** Column ids the surface's connection sorts by — the toggles drawn. Omit for a list with no sort. */
  sortableIds?: readonly string[];
  /** Column ids that carry a funnel — each keeps its selection in the URL under its own name. */
  filterKeys?: readonly string[];
  skeletonColumns: readonly TableSkeletonColumn[];
  skeletonRows: number;
  /** The module's flag has not answered yet: the toolbar draws locked, the rows do not fetch. */
  loading?: boolean;
  /** Above the toolbar while the list has rows — a device tab's sync banner. */
  banner?: ReactNode;
  className?: string;
  children: (list: SoftwareListFrameRenderProps) => ReactNode;
}

const NO_IDS: readonly string[] = [];

function paramName(prefix: string, name: string): string {
  return prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
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
 * the skeleton before the rows answer and the toolbar's retreat when there is
 * nothing to search. The child renders the rows and owns the connection they
 * come from — and how the selections become that connection's filter input.
 *
 * One frame is what keeps a device tab identical to its page: the pages are
 * the reference, and a tab that draws its own toolbar or keeps its search in
 * local state has already drifted.
 */
export function SoftwareListFrame({
  paramPrefix = '',
  placeholder,
  sortableIds = NO_IDS,
  filterKeys = NO_IDS,
  skeletonColumns,
  skeletonRows,
  loading = false,
  banner,
  className,
  children,
}: SoftwareListFrameProps) {
  const searchKey = paramName(paramPrefix, 'search');
  const sortByKey = paramName(paramPrefix, 'sortBy');
  const sortDirKey = paramName(paramPrefix, 'sortDir');

  const { params, setParam, setParams } = useApiParams({
    [searchKey]: { type: 'string', default: '' },
    [sortByKey]: { type: 'string', default: '' },
    [sortDirKey]: { type: 'string', default: 'desc' },
    ...Object.fromEntries(filterKeys.map(key => [paramName(paramPrefix, key), { type: 'array', default: [] }])),
  });

  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(readString(params, searchKey), value => setParam(searchKey, value), 300);

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
    () => Object.fromEntries(filterKeys.map(key => [key, readArray(params, paramName(paramPrefix, key))])),
    [filterKeys, paramPrefix, params],
  );
  const onSelectionsChange = (next: Record<string, string[]>) =>
    setParams(Object.fromEntries(filterKeys.map(key => [paramName(paramPrefix, key), next[key] ?? []])));

  // Sort and the funnels travel as one deferred object so the query lags in
  // lockstep with the search and `isPending` covers all three.
  const narrowing = useMemo(() => ({ sort, selections }), [sort, selections]);
  const {
    deferredFilters: deferredNarrowing,
    deferredSearch,
    isPending,
  } = useDeferredQuery(narrowing, debouncedSearch);

  // The rows before they answer — the same for a query in flight and for the flag's own window.
  const tableSkeleton = (
    <TableSkeleton columns={skeletonColumns} rows={skeletonRows} stickyHeaderOffset={stickyHeaderOffset} />
  );

  return (
    <div className={cn('flex flex-col', className)} style={containerStyle}>
      {/* The banner keeps its own bottom margin: the pinned toolbar's negative top
          margin eats exactly that, instead of the banner's last rows. */}
      {!isEmpty && banner}
      {!isEmpty && (
        <SoftwareSearchToolbar
          toolbarRef={toolbarRef}
          placeholder={placeholder}
          value={searchInput}
          onChange={setSearchInput}
          disabled={loading}
        />
      )}

      {loading ? (
        tableSkeleton
      ) : (
        <Suspense fallback={tableSkeleton}>
          {children({
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
          })}
        </Suspense>
      )}
    </div>
  );
}
