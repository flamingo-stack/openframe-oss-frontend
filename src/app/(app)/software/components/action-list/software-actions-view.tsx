'use client';

import { PlusCircleIcon, Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useState } from 'react';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { SoftwareSearchToolbar } from '../shared/software-search-toolbar';
import { SOFTWARE_SECTIONS } from '../shared/software-sections';
import { SOFTWARE_ACTION_TABLE_COLUMNS, SOFTWARE_ACTIONS_PAGE_SIZE } from './software-actions-columns';
import { SoftwareActionsTable } from './software-actions-table';

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
 * `/software/actions` (design 409:47368): every install and update run across
 * the fleet, the scheduled ones included — one row per package per run. Owns
 * the URL search and the sticky toolbar; the rows suspend below it.
 */
export function SoftwareActionsView({ loading = false }: { loading?: boolean }) {
  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // No filters or sort to defer yet — only the search, newest first as the
  // backend orders it.
  const { deferredSearch, isPending } = useDeferredQuery(null, debouncedSearch);

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
              debouncedSearch={deferredSearch}
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
