'use client';

import {
  ArrowRightUpIcon,
  CodingForkIcon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Input,
  type NoDataProps,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { EMBEDDED_PAGE_OFFSET, EmptyState, SectionLoadError } from '@/app/components/shared';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useTenantConnections } from '../hooks/use-tenant-connections';
import { TenantsTable } from './tenants-table';

const LOAD_ERROR_MESSAGE = "Couldn't load the tenants.";

/**
 * The "Connect Tenant" split button (Figma 1699-8249): the label opens the
 * connect page in place, the arrow half in a new tab — the flow hands off to
 * someone else's admin console, so a technician often wants it beside the list.
 * Exported for the route skeleton, which renders the same action disabled.
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

interface TenantListViewProps {
  /** Narrow the list to one customer — the future Customer → Integrations tab. */
  organizationId?: string;
  /** Rendered inside another page's tab: no back button, no Customers column, no header gap. */
  embedded?: boolean;
}

export function TenantListView({ organizationId, embedded = false }: TenantListViewProps) {
  const handleBack = useSafeBack(routes.settings.root());
  const ownerGate = useOwnerGate();

  const { params, setParam } = useApiParams({ search: { type: 'string', default: '' } });
  // Local search keeps typing responsive; the shared hook debounces it to the
  // URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: localSearch,
    setSearch: setLocalSearch,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value));
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const query = useTenantConnections({ search: debouncedSearch, organizationId });
  const { isLoading, isOffline, error, canClaimEmpty } = queryState(query);
  const connections = query.data;

  // Only workspace owners connect tenants: the action is absent
  // for everyone else, and a placeholder while the role is still unknown — never
  // absent-then-present.
  const actions = ownerGate === 'owner' ? [CONNECT_TENANT_ACTION] : undefined;

  // `canClaimEmpty`, not `!isLoading`: zero rows after a failed or offline load
  // must not read as "you have no tenants".
  const showEmptyState = canClaimEmpty && !debouncedSearch && (connections?.length ?? 0) === 0;

  const tableEmptyState: NoDataProps = canClaimEmpty
    ? {
        title: 'No tenants match',
        description: `Nothing matches "${debouncedSearch}". Try a different name, domain or customer.`,
      }
    : { title: loadErrorProps(isOffline, LOAD_ERROR_MESSAGE).message };

  return (
    <PageLayout
      title="Tenant Management"
      actions={actions}
      actionsVariant="icon-buttons"
      loadingActions={ownerGate === 'loading'}
      backButton={embedded ? undefined : { label: 'Back', onClick: handleBack }}
      className={cn('px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]', embedded && EMBEDDED_PAGE_OFFSET)}
      contentClassName="flex flex-col"
    >
      {(error || isOffline) && (
        <SectionLoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, () => void query.refetch())} />
      )}
      {showEmptyState ? (
        <EmptyState
          icon={<CodingForkIcon />}
          title="No tenants connected yet"
          description="Connect a Microsoft 365 or Google Workspace tenant to see its users and access state here."
          buttonLabel={ownerGate === 'owner' ? 'Connect Tenant' : undefined}
          buttonProps={{ href: routes.settings.tenantNew }}
        />
      ) : (
        <div style={containerStyle}>
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              placeholder="Search for Tenant"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
              aria-label="Search for Tenant"
            />
          </div>
          <TenantsTable
            connections={connections}
            isLoading={isLoading}
            emptyState={tableEmptyState}
            hideCustomerColumn={embedded}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </div>
      )}
    </PageLayout>
  );
}
