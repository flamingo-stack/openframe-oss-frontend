'use client';

import { LoadingWhen, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { EMBEDDED_PAGE_OFFSET } from '@/app/components/shared';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { DirectoryUsersTable } from './directory-users-table';
import { toFilter, type UserSelections } from './users-filter';

interface UsersViewProps {
  /** A customer's Users tab (Figma 733:98943): only the people its rules claim. Absent on `/users`. */
  organizationId?: string;
  /** Rendered inside another page's tab: the title's top gap is cancelled (`EMBEDDED_PAGE_OFFSET`). */
  embedded?: boolean;
  /** The flag has not answered yet: the frame draws, the rows do not fetch. */
  loading?: boolean;
}

/**
 * `/users` (Figma 733:99047): every user of every connected tenant, unattributed ones included, one row per person.
 * With a customer it is that customer's Users tab. Owns the URL state (search + the funnels) and the sticky toolbar;
 * the rows suspend below it.
 */
export function UsersView({ organizationId, embedded = false, loading = false }: UsersViewProps) {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    tenant: { type: 'array', default: [] },
    status: { type: 'array', default: [] },
    license: { type: 'array', default: [] },
  });
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const selections = useMemo<UserSelections>(
    () => ({ tenant: params.tenant, status: params.status, license: params.license }),
    [params.tenant, params.status, params.license],
  );
  const filter = useMemo(() => toFilter(selections), [selections]);
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(filter, debouncedSearch);

  return (
    // No page padding here: it lives in the page shell (or the customer page), around the error boundary.
    <PageLayout title="Users" className={embedded ? EMBEDDED_PAGE_OFFSET : undefined}>
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <SearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Users"
            value={searchInput}
            onChange={setSearchInput}
            disabled={loading}
          />
        )}
        {/* The rows before they answer, the same for a query in flight and for the flag's own window. */}
        <LoadingWhen loading={loading}>
          <DirectoryUsersTable
            organizationId={organizationId}
            backendFilters={deferredFilters}
            debouncedSearch={deferredSearch}
            selections={selections}
            onSelectionsChange={next => setParams(next)}
            isPending={isPending}
            onEmptyChange={setIsEmpty}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </LoadingWhen>
      </div>
    </PageLayout>
  );
}
