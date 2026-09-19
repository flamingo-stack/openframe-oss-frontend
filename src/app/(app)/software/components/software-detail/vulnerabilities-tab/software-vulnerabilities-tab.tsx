'use client';

import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, Suspense, useMemo } from 'react';
import type { SoftwareVulnerabilityFilterInput } from '@/__generated__/softwareVulnerabilitiesTableQuery.graphql';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareSearchToolbar } from '../../shared/software-search-toolbar';
import { useServerSort } from '../../shared/use-server-sort';
import {
  SOFTWARE_VULNERABILITIES_PAGE_SIZE,
  SOFTWARE_VULNERABILITIES_SORTABLE_COLUMN_IDS,
  SOFTWARE_VULNERABILITIES_TABLE_COLUMNS,
} from './software-vulnerabilities-columns';
import { SoftwareVulnerabilitiesTable } from './software-vulnerabilities-table';

/**
 * Software → Vulnerabilities: the CVEs matched to this title. Owns the tab's
 * URL state and search toolbar; the rows suspend below it.
 */
export const SoftwareVulnerabilitiesTab = memo(function SoftwareVulnerabilitiesTabImpl({
  softwareId,
}: {
  softwareId: string;
}) {
  const { params, setParam, setParams } = useApiParams({
    cveSearch: { type: 'string', default: '' },
    cveSeverity: { type: 'array', default: [] },
    cveSortBy: { type: 'string', default: '' },
    cveSortDir: { type: 'string', default: 'desc' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.cveSearch, value => setParam('cveSearch', value), 300);

  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const { sort, sortState, onSortChange } = useServerSort({
    sortBy: params.cveSortBy,
    sortDir: params.cveSortDir,
    sortableIds: SOFTWARE_VULNERABILITIES_SORTABLE_COLUMN_IDS,
    onChange: (sortBy, sortDir) => setParams({ cveSortBy: sortBy, cveSortDir: sortDir }),
  });

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references.
  const queryVars = useMemo(() => {
    const filter: SoftwareVulnerabilityFilterInput | null =
      params.cveSeverity.length > 0
        ? { severities: params.cveSeverity as SoftwareVulnerabilityFilterInput['severities'] }
        : null;
    return { filter, sort };
  }, [params.cveSeverity, sort]);
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  return (
    <div className="flex flex-col pt-[var(--spacing-system-l)]" style={containerStyle}>
      <SoftwareSearchToolbar
        toolbarRef={toolbarRef}
        placeholder="Search for Vulnerability"
        value={searchInput}
        onChange={setSearchInput}
      />

      <Suspense
        fallback={
          <TableSkeleton
            columns={SOFTWARE_VULNERABILITIES_TABLE_COLUMNS}
            rows={SOFTWARE_VULNERABILITIES_PAGE_SIZE}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        }
      >
        <SoftwareVulnerabilitiesTable
          softwareId={softwareId}
          backendFilters={deferredVars.filter}
          debouncedSearch={deferredSearch}
          sort={deferredVars.sort}
          sortState={sortState}
          onSortChange={onSortChange}
          severityFilter={params.cveSeverity}
          onSeverityFilterChange={values => setParam('cveSeverity', values)}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
        />
      </Suspense>
    </div>
  );
});
SoftwareVulnerabilitiesTab.displayName = 'SoftwareVulnerabilitiesTab';
