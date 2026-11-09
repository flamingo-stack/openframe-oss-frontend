'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { EMBEDDED_PAGE_OFFSET } from '@/app/components/shared';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { GroupsTable, membersOrderBy } from './groups-table';

/**
 * Customer → Groups (Figma 733:99271): the groups that touch the customer. Owns the URL state (search + the Members
 * sort) and the sticky toolbar; the rows suspend below it. No Feed funnel: `directoryGroups` takes no feed filter.
 */
export function GroupsView({ organizationId }: { organizationId: string }) {
  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
    membersSort: { type: 'string', default: '' },
  });
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const membersSort = params.membersSort === 'asc' || params.membersSort === 'desc' ? params.membersSort : null;
  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const orderBy = useMemo(() => membersOrderBy(membersSort), [membersSort]);
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(orderBy, debouncedSearch);

  return (
    <PageLayout title={isEmpty ? undefined : 'Groups'} className={isEmpty ? undefined : EMBEDDED_PAGE_OFFSET}>
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <SearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Groups"
            value={searchInput}
            onChange={setSearchInput}
          />
        )}
        <GroupsTable
          organizationId={organizationId}
          orderBy={deferredFilters}
          debouncedSearch={deferredSearch}
          membersSort={membersSort}
          onToggleMembersSort={() => setParam('membersSort', membersSort === 'desc' ? 'asc' : 'desc')}
          isPending={isPending}
          onEmptyChange={setIsEmpty}
          stickyHeaderOffset={stickyHeaderOffset}
        />
      </div>
    </PageLayout>
  );
}
