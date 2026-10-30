'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useState } from 'react';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { useServerSort } from '../../shared/use-server-sort';
import { SOFTWARE_VULNERABILITIES_SORTABLE_COLUMN_IDS } from './software-vulnerabilities-columns';
import { SoftwareVulnerabilitiesTable } from './software-vulnerabilities-table';

/**
 * Software → Vulnerabilities: the CVEs matched to this title. Owns the tab's
 * URL state and search toolbar; the rows suspend below it.
 */
export const SoftwareVulnerabilitiesTab = memo(function SoftwareVulnerabilitiesTabImpl({
  softwareId,
  loading = false,
}: {
  softwareId: string;
  /** The module's flag has not answered yet: the toolbar draws locked, the rows do not fetch. */
  loading?: boolean;
}) {
  const { params, setParam, setParams } = useApiParams({
    cveSearch: { type: 'string', default: '' },
    cveSortBy: { type: 'string', default: '' },
    cveSortDir: { type: 'string', default: 'desc' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.cveSearch, value => setParam('cveSearch', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const { sort, sortState, onSortChange } = useServerSort({
    sortBy: params.cveSortBy,
    sortDir: params.cveSortDir,
    sortableIds: SOFTWARE_VULNERABILITIES_SORTABLE_COLUMN_IDS,
    onChange: (sortBy, sortDir) => setParams({ cveSortBy: sortBy, cveSortDir: sortDir }),
  });

  // Sort travels as a deferred object so the query lags in lockstep with the
  // search and `isPending` covers both. The tab has no funnels.
  const { deferredFilters: deferredSort, deferredSearch, isPending } = useDeferredQuery(sort, debouncedSearch);

  const rows = (
    <SoftwareVulnerabilitiesTable
      softwareId={softwareId}
      debouncedSearch={deferredSearch}
      sort={deferredSort}
      sortState={sortState}
      onSortChange={onSortChange}
      isPending={isPending}
      onEmptyChange={setIsEmpty}
      stickyHeaderOffset={stickyHeaderOffset}
    />
  );

  return (
    <div className="flex flex-col pt-[var(--spacing-system-l)]" style={containerStyle}>
      {!isEmpty && (
        <SearchToolbar
          toolbarRef={toolbarRef}
          placeholder="Search for Vulnerability"
          value={searchInput}
          onChange={setSearchInput}
          disabled={loading}
        />
      )}

      {/* The rows before they answer, the same for a query in flight (the table's own boundary) and for the flag's own
          window: the table itself, in a loading scope, where it draws its own loading state and does not fetch. */}
      <LoadingWhen loading={loading}>{rows}</LoadingWhen>
    </div>
  );
});
SoftwareVulnerabilitiesTab.displayName = 'SoftwareVulnerabilitiesTab';
