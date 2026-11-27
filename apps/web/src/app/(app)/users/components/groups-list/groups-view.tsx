'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CURSOR_PAGER_KEYS, useApiParams, useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { EMBEDDED_PAGE_OFFSET } from '@/app/components/shared';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { GROUPS_PAGE_SIZE, GroupsTable, membersOrderBy } from './groups-table';

/**
 * The view's URL prefix. Its one mount is a customer's Groups tab, which shares the page's query string with the
 * other tabs (the customer page keeps every key when the tab changes, and the Users tab has a search and a pager of
 * its own), so its search, the Members sort and the pager sit under `groups…` (`groupsSearch`, `groupsMembersSort`,
 * `groupsCursor`, `groupsPage`, `groupsRefresh`).
 */
const PARAM_PREFIX = 'groups';

/**
 * Customer → Groups (Figma 733:99271): the groups that touch the customer, one page at a time with First · Prev ·
 * Next. Owns the URL state (search, the Members sort and the pager) and the sticky toolbar; the rows suspend below it.
 * No Feed funnel: `directoryGroups` takes no feed filter.
 *
 * A change to the search or the sort drops the cursor in the SAME URL write (one history entry on page 2+, so Back
 * returns to the old view): a cursor follows the order it was issued under.
 */
export function GroupsView({ organizationId }: { organizationId: string }) {
  const { params, setParam } = useApiParams(
    {
      search: { type: 'string', default: '' },
      membersSort: { type: 'string', default: '' },
    },
    { prefix: PARAM_PREFIX, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  // The safety net for a cursor issued under another search or sort. Not the customer: it is the page's.
  const pager = useCursorPager({
    prefix: PARAM_PREFIX,
    pageSize: GROUPS_PAGE_SIZE,
    ...PAGED_LISTS.directoryGroups,
    resetOn: JSON.stringify(params),
  });
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    300,
  );
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const membersSort = params.membersSort === 'asc' || params.membersSort === 'desc' ? params.membersSort : null;
  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const orderBy = useMemo(() => membersOrderBy(membersSort), [membersSort]);
  // The sort, the search and the page are deferred together; the query reads the URL's search.
  const { deferredFilters, deferredSearch, deferredPage, isPending } = useDeferredQuery(
    orderBy,
    params.search,
    pager.variables,
  );

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
          position={{ pager, pageVariables: deferredPage, paramPrefix: PARAM_PREFIX }}
        />
      </div>
    </PageLayout>
  );
}
