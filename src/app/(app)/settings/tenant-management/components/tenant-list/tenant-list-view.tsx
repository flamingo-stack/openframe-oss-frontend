'use client';

import { ArrowRightUpIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useState } from 'react';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { TenantsTable } from './tenants-table';
import { TENANTS_PAGE_SIZE, TENANTS_TABLE_COLUMNS } from './tenants-table-columns';

/**
 * The "Connect Tenant" split button (Figma 1699-8249): the label opens the connect page in place,
 * the arrow in a new tab — the flow hands off to someone else's admin console.
 */
export const CONNECT_TENANT_ACTION: PageActionButton = {
  label: 'Connect Tenant',
  variant: 'outline',
  href: routes.settings.tenantNew,
  iconAction: {
    icon: <ArrowRightUpIcon className="h-5 w-5" />,
    'aria-label': 'Open Connect Tenant in a new tab',
    href: routes.settings.tenantNew,
    openInNewTab: true,
  },
};

/** The list has no filter funnels; a stable value keeps `useDeferredQuery` from deferring every render. */
const NO_FILTERS = null;

interface TenantListViewProps {
  /** The module's flag has not answered yet: the frame draws, the rows do not fetch. */
  loading?: boolean;
}

export function TenantListView({ loading = false }: TenantListViewProps) {
  const handleBack = useSafeBack(routes.settings.root());
  const ownerGate = useOwnerGate();

  const { params, setParam } = useApiParams({ search: { type: 'string', default: '' } });
  // Local search keeps typing responsive; the hook debounces it into the URL param.
  const {
    search: localSearch,
    setSearch: setLocalSearch,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value));
  const { deferredSearch, isPending } = useDeferredQuery(NO_FILTERS, debouncedSearch);
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Only workspace owners connect tenants; a placeholder while the role is unknown, never absent-then-present.
  const actions = ownerGate === 'owner' ? [CONNECT_TENANT_ACTION] : undefined;

  const tableSkeleton = (
    <TableSkeleton columns={TENANTS_TABLE_COLUMNS} rows={TENANTS_PAGE_SIZE} stickyHeaderOffset={stickyHeaderOffset} />
  );

  return (
    // No page padding here: it lives in `TenantPageShell`, around the error boundary.
    <PageLayout
      title="Tenant Management"
      actions={actions}
      actionsVariant="icon-buttons"
      loadingActions={ownerGate === 'loading'}
      backButton={{ label: 'Back', onClick: handleBack }}
      contentClassName="flex flex-col"
    >
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              placeholder="Search for Tenant"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              disabled={loading}
              startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
              aria-label="Search for Tenant"
            />
          </div>
        )}
        {loading ? (
          tableSkeleton
        ) : (
          <Suspense fallback={tableSkeleton}>
            <TenantsTable
              search={deferredSearch}
              isPending={isPending}
              onEmptyChange={setIsEmpty}
              stickyHeaderOffset={stickyHeaderOffset}
              canConnect={ownerGate === 'owner'}
            />
          </Suspense>
        )}
      </div>
    </PageLayout>
  );
}
