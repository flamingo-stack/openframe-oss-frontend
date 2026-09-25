'use client';

import { PlusCircleIcon, Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useMemo, useState } from 'react';
import type { SoftwareActionFilterInput } from '@/__generated__/softwareActionsTableQuery.graphql';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { SoftwareSearchToolbar } from '../shared/software-search-toolbar';
import { SOFTWARE_SECTIONS } from '../shared/software-sections';
import { SOFTWARE_ACTION_TABLE_COLUMNS, SOFTWARE_ACTIONS_PAGE_SIZE } from './software-actions-columns';
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
    ...(selections.action.length > 0 && { actions: selections.action as SoftwareActionFilterInput['actions'] }),
    ...(selections.engine.length > 0 && { engines: selections.engine as SoftwareActionFilterInput['engines'] }),
    ...(selections.status.length > 0 && { statuses: selections.status as SoftwareActionFilterInput['statuses'] }),
  };
}

/**
 * `/software/actions` (design 409:47368): every install and update run across
 * the fleet, the scheduled ones included — one row per package per run. Owns
 * the URL state (search + the three funnels) and the sticky toolbar; the rows
 * suspend below it.
 */
export function SoftwareActionsView({ loading = false }: { loading?: boolean }) {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    action: { type: 'array', default: [] },
    engine: { type: 'array', default: [] },
    status: { type: 'array', default: [] },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending
  // refetch by comparing references.
  const selections = useMemo<SoftwareActionSelections>(
    () => ({ action: params.action, engine: params.engine, status: params.status }),
    [params.action, params.engine, params.status],
  );
  const filter = useMemo(() => toFilter(selections), [selections]);

  // The funnels and the search are deferred together, so `isPending` covers
  // both. No sort: the list keeps the backend's own order, newest first.
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(filter, debouncedSearch);

  // The rows before they answer — the same for a query in flight and for the flag's own window.
  const tableSkeleton = (
    <TableSkeleton
      columns={SOFTWARE_ACTION_TABLE_COLUMNS}
      rows={SOFTWARE_ACTIONS_PAGE_SIZE}
      stickyHeaderOffset={stickyHeaderOffset}
    />
  );

  return (
    // No page padding here: it lives in `SoftwarePageShell`, around the error
    // boundary, so a thrown query keeps the title indented.
    <PageLayout title={SOFTWARE_SECTIONS.actions.label} actions={PAGE_ACTIONS}>
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <SoftwareSearchToolbar
            toolbarRef={toolbarRef}
            placeholder="Search for Update"
            value={searchInput}
            onChange={setSearchInput}
            disabled={loading}
          />
        )}

        {loading ? (
          tableSkeleton
        ) : (
          <Suspense fallback={tableSkeleton}>
            <SoftwareActionsTable
              backendFilters={deferredFilters}
              debouncedSearch={deferredSearch}
              selections={selections}
              onSelectionsChange={next => setParams(next)}
              isPending={isPending}
              onEmptyChange={setIsEmpty}
              stickyHeaderOffset={stickyHeaderOffset}
            />
          </Suspense>
        )}
      </div>
    </PageLayout>
  );
}
