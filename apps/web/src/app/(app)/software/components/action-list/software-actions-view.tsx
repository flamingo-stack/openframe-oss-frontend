'use client';

import { SOFTWARE_ACTION_COPY } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon, Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CURSOR_PAGER_KEYS, useApiParams, useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import type { SoftwareActionFilterInput } from '@/__generated__/softwareActionsTableQuery.graphql';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { routes } from '@/lib/routes';
import { SOFTWARE_SECTIONS } from '../shared/software-sections';
import { SOFTWARE_ACTIONS_PAGE_SIZE } from './software-actions-columns';
import { type SoftwareActionSelections, SoftwareActionsTable } from './software-actions-table';

const PAGE_ACTIONS: PageActionButton[] = [
  {
    label: SOFTWARE_ACTION_COPY.UPDATE.formTitle,
    variant: 'outline',
    href: routes.software.update,
    icon: <Refresh02HrIcon size={24} className="text-ods-text-secondary" />,
  },
  {
    label: SOFTWARE_ACTION_COPY.INSTALL.formTitle,
    variant: 'outline',
    href: routes.software.install,
    icon: <PlusCircleIcon size={24} className="text-ods-text-secondary" />,
  },
];

/**
 * The funnels' selection as `softwareActions(filter:)` takes it — null when
 * nothing is ticked, so the query and the empty-state guard read "unfiltered"
 * off one value.
 */
function toFilter(selections: SoftwareActionSelections): SoftwareActionFilterInput | null {
  if (selections.action.length === 0 && selections.engine.length === 0 && selections.status.length === 0) {
    return null;
  }
  return {
    // The Action funnel ticks kinds (Install / Update / Auto-update / Adopt); INSTALL and UPDATE are kinds too, so a
    // link from before the funnel moved to kinds still narrows the same way.
    ...(selections.action.length > 0 && { kinds: selections.action as SoftwareActionFilterInput['kinds'] }),
    ...(selections.engine.length > 0 && { engines: selections.engine as SoftwareActionFilterInput['engines'] }),
    ...(selections.status.length > 0 && { statuses: selections.status as SoftwareActionFilterInput['statuses'] }),
  };
}

/**
 * `/software/actions` (design 409:47368): every install and update run across
 * the fleet, the scheduled ones included — one row per package per run. Owns
 * the URL state (search + the three funnels + the page's cursor) and the sticky
 * toolbar; the rows suspend below it.
 */
export function SoftwareActionsView({ loading = false }: { loading?: boolean }) {
  // A change to the search or a funnel drops the pager's cursor in the SAME URL write (one history entry on page 2+,
  // so Back returns to the old view).
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      action: { type: 'array', default: [] },
      engine: { type: 'array', default: [] },
      status: { type: 'array', default: [] },
    },
    { resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    pageSize: SOFTWARE_ACTIONS_PAGE_SIZE,
    ...PAGED_LISTS.softwareActions,
    resetOn: JSON.stringify(params),
  });

  // Local search input keeps typing responsive; the shared hook debounces it to the URL param.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    300,
  );

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references.
  const selections = useMemo<SoftwareActionSelections>(
    () => ({ action: params.action, engine: params.engine, status: params.status }),
    [params.action, params.engine, params.status],
  );
  const filter = useMemo(() => toFilter(selections), [selections]);

  // The funnels, the search and the page are deferred together, so `isPending` covers all three. No sort: the list
  // keeps the backend's own order, newest first. The query reads the search from the URL, not the box's debounced
  // value: the URL write that carries a new search drops the cursor in the same navigation, so the two can never meet
  // in one request (the box's value runs ahead of the URL by one commit).
  const { deferredFilters, deferredSearch, deferredPage, isPending } = useDeferredQuery(
    filter,
    params.search,
    pager.variables,
  );

  const rows = (
    <SoftwareActionsTable
      backendFilters={deferredFilters}
      debouncedSearch={deferredSearch}
      selections={selections}
      onSelectionsChange={next => setParams(next)}
      isPending={isPending}
      onEmptyChange={setIsEmpty}
      stickyHeaderOffset={stickyHeaderOffset}
      pager={pager}
      pageVariables={deferredPage}
    />
  );

  return (
    // No page padding here: it lives in `SoftwarePageShell`, around the error
    // boundary, so a thrown query keeps the title indented.
    <PageLayout title={SOFTWARE_SECTIONS.actions.label} actions={PAGE_ACTIONS}>
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <SearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Update"
            value={searchInput}
            onChange={setSearchInput}
            disabled={loading}
          />
        )}

        {/* The rows before they answer, the same for a query in flight (the table's own boundary) and for the flag's
            own window: the table itself, in a loading scope, where it draws its own loading state and does not fetch. */}
        <LoadingWhen loading={loading}>{rows}</LoadingWhen>
      </div>
    </PageLayout>
  );
}
