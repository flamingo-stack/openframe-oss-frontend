'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useState } from 'react';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareSearchToolbar } from '../shared/software-search-toolbar';
import { useServerSort } from '../shared/use-server-sort';
import {
  SOFTWARE_LIST_PAGE_SIZE,
  SOFTWARE_LIST_SORTABLE_COLUMN_IDS,
  SOFTWARE_LIST_TABLE_COLUMNS,
} from './software-list-columns';
import { SoftwareListTable } from './software-list-table';

export interface SoftwareListViewProps {
  /** Page title, e.g. "All Software". */
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  /** The module's flag has not answered yet: the frame draws, the rows do not fetch. */
  loading?: boolean;
}

/**
 * The Software inventory page — one row per software title, aggregated across
 * the fleet. Owns the URL state (search + sort) and the sticky search toolbar;
 * the rows suspend below it.
 */
export function SoftwareListView({ title, emptyTitle, emptyDescription, loading = false }: SoftwareListViewProps) {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    // Server-side sort: backend sort field ('devicesCount' / 'cveCount' from the
    // two header toggles) + direction. Empty sortBy = backend default order.
    sortBy: { type: 'string', default: '' },
    sortDir: { type: 'string', default: 'desc' },
  });

  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const { sort, sortState, onSortChange } = useServerSort({
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    sortableIds: SOFTWARE_LIST_SORTABLE_COLUMN_IDS,
    onChange: (sortBy, sortDir) => setParams({ sortBy, sortDir }),
  });

  // Sort travels as a deferred object so the query lags in lockstep with the
  // search and `isPending` covers both. The list has no filter funnels.
  const { deferredFilters: deferredSort, deferredSearch, isPending } = useDeferredQuery(sort, debouncedSearch);

  // The rows before they answer — the same for a query in flight and for the flag's own window.
  const tableSkeleton = (
    <TableSkeleton
      columns={SOFTWARE_LIST_TABLE_COLUMNS}
      rows={SOFTWARE_LIST_PAGE_SIZE}
      stickyHeaderOffset={stickyHeaderOffset}
    />
  );

  return (
    // No page padding here: it lives in `SoftwarePageShell`, around the error
    // boundary, so a thrown query keeps the title indented.
    <PageLayout title={title}>
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <SoftwareSearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Software"
            value={searchInput}
            onChange={setSearchInput}
            disabled={loading}
          />
        )}

        {loading ? (
          tableSkeleton
        ) : (
          <Suspense fallback={tableSkeleton}>
            <SoftwareListTable
              debouncedSearch={deferredSearch}
              sort={deferredSort}
              sortState={sortState}
              onSortChange={onSortChange}
              isPending={isPending}
              onEmptyChange={setIsEmpty}
              stickyHeaderOffset={stickyHeaderOffset}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
            />
          </Suspense>
        )}
      </div>
    </PageLayout>
  );
}
