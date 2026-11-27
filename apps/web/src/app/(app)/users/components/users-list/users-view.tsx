'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, LoadingWhen, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CURSOR_PAGER_KEYS, useApiParams, useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { EMBEDDED_PAGE_OFFSET } from '@/app/components/shared';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { DirectoryUsersTable } from './directory-users-table';
import { USERS_PAGE_SIZE } from './users-columns';
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
 * The view's URL prefix where it is drawn. On `/users` the view owns the query string: no prefix. In a customer's
 * Users tab it shares the page's query string with the other tabs, and the customer page keeps every key when the tab
 * changes, so an unprefixed cursor would reach the Groups tab's table: its search, funnels and pager sit under
 * `users…` (`usersSearch`, `usersCustomer`, `usersStatus`, `usersLicense`, `usersCursor`, `usersPage`,
 * `usersRefresh`).
 */
function usersParamPrefix(organizationId: string | undefined): string | undefined {
  return organizationId ? 'users' : undefined;
}

/**
 * `/users` (Figma 733:99047): every user of every connected tenant, unattributed ones included, one row per person,
 * one page at a time with First · Prev · Next. With a customer it is that customer's Users tab. Owns the URL state
 * (search, the funnels and the pager) and the sticky toolbar; the rows suspend below it.
 *
 * A change to the search or a funnel drops the cursor in the SAME URL write (one history entry on page 2+, so Back
 * returns to the old view). The box keeps the typed search locally; the query reads the URL's, so a search and a cursor
 * from another narrowing never meet in one request.
 */
export function UsersView({ organizationId, embedded = false, loading = false }: UsersViewProps) {
  const paramPrefix = usersParamPrefix(organizationId);
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      customer: { type: 'array', default: [] },
      status: { type: 'array', default: [] },
      license: { type: 'array', default: [] },
    },
    { prefix: paramPrefix, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  // The safety net for a cursor issued under other filters: the URL's narrowing. Not the customer: it is the page's.
  const pager = useCursorPager({
    prefix: paramPrefix,
    pageSize: USERS_PAGE_SIZE,
    ...PAGED_LISTS.directoryUsers,
    resetOn: JSON.stringify(params),
  });
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    300,
  );
  const [isEmpty, setIsEmpty] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const selections = useMemo<UserSelections>(
    () => ({ customer: params.customer, status: params.status, license: params.license }),
    [params.customer, params.status, params.license],
  );
  const filter = useMemo(() => toFilter(selections), [selections]);
  // The funnels, the search and the page are deferred together, so `isPending` covers all three.
  const { deferredFilters, deferredSearch, deferredPage, isPending } = useDeferredQuery(
    filter,
    params.search,
    pager.variables,
  );

  // A customer with no users shows the placeholder alone under its tabs (Figma 882:74121).
  const showTitle = !(embedded && isEmpty);

  return (
    // No page padding here: it lives in the page shell (or the customer page), around the error boundary.
    <PageLayout
      title={showTitle ? 'Users' : undefined}
      className={embedded && showTitle ? EMBEDDED_PAGE_OFFSET : undefined}
    >
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <SearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Users"
            value={searchInput}
            onChange={setSearchInput}
            disabled={loading}
            actions={
              <Button
                variant="outline"
                size="icon"
                className="content-md:hidden"
                onClick={() => setFiltersOpen(true)}
                disabled={loading}
                aria-label="Open filters"
                leftIcon={<Filter02Icon className="text-ods-text-primary" />}
              />
            }
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
            filtersOpen={filtersOpen}
            onFiltersClose={() => setFiltersOpen(false)}
            pager={pager}
            pageVariables={deferredPage}
            paramPrefix={paramPrefix}
          />
        </LoadingWhen>
      </div>
    </PageLayout>
  );
}
