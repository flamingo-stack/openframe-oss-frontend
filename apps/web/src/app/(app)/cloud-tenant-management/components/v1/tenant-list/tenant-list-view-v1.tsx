'use client';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-list/tenant-list-view.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { ArrowRightUpIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Input,
  LoadingWhen,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CURSOR_PAGER_KEYS, useApiParams, useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { routes } from '@/lib/routes';
import { ConsentAnnouncementBanner } from '../../tenant-list/consent-announcement-banner';
import { TENANTS_V1_PAGE_SIZE, TenantsTableV1 } from './tenants-table-v1';

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

/** The list has no filter funnels; a stable value keeps `useDeferredQuery` from deferring every render. */
const NO_FILTERS = null;

interface TenantListViewProps {
  /** The module's flag has not answered yet: the frame draws, the rows do not fetch. */
  loading?: boolean;
}

/**
 * The tenants list, one page at a time with First · Prev · Next. A top-level page, so no prefix: the search and the
 * pager (`cursor`, `page`, `refresh`) sit in the URL as they are, and a new search drops the cursor in the SAME URL
 * write (one history entry on page 2+, so Back returns to the old view).
 */
export function TenantListViewV1({ loading = false }: TenantListViewProps) {
  const { params, setParam } = useApiParams(
    { search: { type: 'string', default: '' } },
    { resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    pageSize: TENANTS_V1_PAGE_SIZE,
    ...PAGED_LISTS.directoryConnections,
    resetOn: params.search,
  });
  // Local search keeps typing responsive; the hook debounces it into the URL param.
  const { search: localSearch, setSearch: setLocalSearch } = useSearchParam(params.search, value =>
    setParam('search', value),
  );
  // The search and the page are deferred together, so `isPending` covers both. The list reads the search from the
  // URL, the write that drops the cursor, never the box's debounced value, which runs one commit ahead.
  const { deferredSearch, deferredPage, isPending } = useDeferredQuery(NO_FILTERS, params.search, pager.variables);
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
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              userValue
              placeholder="Search for Tenant"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              disabled={loading}
              startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
              aria-label="Search for Tenant"
            />
          </div>
        )}
        {/* The rows before they answer, the same for a query in flight and for the flag's own window: the table
            itself, in a loading scope, where it draws its own loading state and does not fetch. */}
        <LoadingWhen loading={loading}>
          <TenantsTableV1
            search={deferredSearch}
            isPending={isPending}
            onEmptyChange={setIsEmpty}
            stickyHeaderOffset={stickyHeaderOffset}
            pager={pager}
            pageVariables={deferredPage}
          />
        </LoadingWhen>
      </div>
    </PageLayout>
  );
}
