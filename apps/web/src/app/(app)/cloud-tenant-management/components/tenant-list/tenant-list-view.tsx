'use client';

import {
  ArrowRightUpIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  FilterModal,
  Input,
  LoadingWhen,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { ConsentAnnouncementBanner } from './consent-announcement-banner';
import {
  TENANT_SORT_COLUMNS,
  type TenantSelections,
  tenantSortDirection,
  toTenantFilter,
  toTenantOrderBy,
} from './tenants-filter';
import { TenantsTable } from './tenants-table';
import { useTenantFilters } from './use-tenant-filters';

/**
 * The "Connect Tenant" split button (Figma 1699-8249): the label opens the connect page in place,
 * the arrow in a new tab — the flow hands off to someone else's admin console.
 */
const CONNECT_TENANT_ACTION: PageActionButton = {
  label: 'Connect Tenant',
  variant: 'outline',
  href: routes.cloudTenantManagement.new(),
  iconAction: {
    icon: <ArrowRightUpIcon className="h-5 w-5" />,
    'aria-label': 'Open Connect Tenant in a new tab',
    href: routes.cloudTenantManagement.new(),
    openInNewTab: true,
  },
};

interface TenantListViewProps {
  /** The module's flag has not answered yet: the frame draws, the rows do not fetch. */
  loading?: boolean;
}

export function TenantListView({ loading = false }: TenantListViewProps) {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    tenant: { type: 'array', default: [] },
    customer: { type: 'array', default: [] },
    licenses: { type: 'array', default: [] },
    access: { type: 'array', default: [] },
    sortBy: { type: 'string', default: '' },
    sortDirection: { type: 'string', default: '' },
  });
  // Local search keeps typing responsive; the hook debounces it into the URL param.
  const {
    search: localSearch,
    setSearch: setLocalSearch,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value));
  // Memoized for their identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const selections = useMemo<TenantSelections>(
    () => ({ tenant: params.tenant, customer: params.customer, licenses: params.licenses, access: params.access }),
    [params.tenant, params.customer, params.licenses, params.access],
  );
  const query = useMemo(
    () => ({
      filter: toTenantFilter(selections),
      orderBy: toTenantOrderBy(params.sortBy, params.sortDirection),
    }),
    [selections, params.sortBy, params.sortDirection],
  );
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(query, debouncedSearch);
  const { options, pending } = useTenantFilters(debouncedSearch, query.filter, !loading);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  return (
    // No page padding here: it lives in `TenantPageShell`, around the error boundary.
    <PageLayout
      title="Cloud Tenant Management"
      actions={[CONNECT_TENANT_ACTION]}
      actionsVariant="icon-buttons"
      contentClassName="flex flex-col"
    >
      <div className="flex flex-col" style={containerStyle}>
        {/* Most workspaces have no notice; one that has it reads it before the list. */}
        {!loading && <ConsentAnnouncementBanner data-loading-optional />}
        {!isEmpty && (
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              userValue
              placeholder="Search for Tenant"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              disabled={loading}
              startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
              aria-label="Search for Tenant"
              className="flex-1"
            />
            {/* On every width: the column funnels cannot also sort, and a phone has no funnels (Figma 3037-5398). */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setFiltersOpen(true)}
              disabled={loading}
              aria-label="Sort and filter"
              leftIcon={<Filter02Icon className="text-ods-text-primary" />}
            />
          </div>
        )}
        {/* The rows before they answer, the same for a query in flight and for the flag's own window: the table
            itself, in a loading scope, where it draws its own loading state and does not fetch. */}
        <LoadingWhen loading={loading}>
          <TenantsTable
            search={deferredSearch}
            filter={deferredFilters.filter}
            orderBy={deferredFilters.orderBy}
            filters={{ options, selections, onChange: setParams, pending }}
            isPending={isPending}
            onEmptyChange={setIsEmpty}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </LoadingWhen>
        <FilterModal
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filterGroups={[
            { id: 'tenant', title: 'Provider', options: options.tenant ?? [] },
            { id: 'customer', title: 'Customers', options: options.customer ?? [] },
            { id: 'access', title: 'Access', options: options.access ?? [] },
            { id: 'licenses', title: 'Licences', options: options.licenses ?? [] },
          ]}
          currentFilters={{ ...selections }}
          onFilterChange={filters =>
            setParams({
              tenant: filters.tenant ?? [],
              customer: filters.customer ?? [],
              licenses: filters.licenses ?? [],
              access: filters.access ?? [],
            })
          }
          sortConfig={{
            columns: TENANT_SORT_COLUMNS,
            sortBy: params.sortBy || undefined,
            sortDirection: tenantSortDirection(params.sortDirection),
          }}
          onSort={(sortBy, sortDirection) => setParams({ sortBy, sortDirection })}
          onSortClear={() => setParams({ sortBy: '', sortDirection: '' })}
        />
      </div>
    </PageLayout>
  );
}
