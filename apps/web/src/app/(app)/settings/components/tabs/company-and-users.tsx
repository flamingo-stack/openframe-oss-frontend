'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { PlusCircleIcon, UserPlusIcon, UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { type EmployeesTab, routes, TAB_IDS } from '@/lib/routes';
import { AddUsersModal } from '../add-users-modal';
import { type EmployeeSelections, NO_EMPLOYEE_SELECTIONS } from '../employees/employee-filters';
import { InvitationsListTable } from '../employees/invitations-list-table';
import { affectedInvitationsListings, invitationsListingId } from '../employees/invitations-listing';
import { UsersListTable } from '../employees/users-list-table';

const EMPLOYEES_TAB_VIEWS = {
  users: { label: 'Users', icon: UsersIcon, search: 'Search for Users' },
  invitations: { label: 'Invitations', icon: UserPlusIcon, search: 'Search for Invitations' },
} satisfies Record<EmployeesTab, object>;

const EMPLOYEES_TABS: TabItem[] = TAB_IDS.employees.map(id => ({
  id,
  label: EMPLOYEES_TAB_VIEWS[id].label,
  icon: EMPLOYEES_TAB_VIEWS[id].icon,
}));

function isEmployeesTab(value: string): value is EmployeesTab {
  return TAB_IDS.employees.some(tab => tab === value);
}

/**
 * Settings → Employees: users and open invitations, one tab each, both searched,
 * narrowed and paged on the server. The search is shared by the tabs; the funnels
 * belong to the open tab and a switch clears them.
 */
export function CompanyAndUsersTab() {
  const handleBack = useSafeBack(routes.settings.root());
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { params, setParam, setParams } = useApiParams({
    tab: { type: 'string', default: 'users' },
    search: { type: 'string', default: '' },
    roles: { type: 'array', default: [] },
    status: { type: 'array', default: [] },
  });
  const tab: EmployeesTab = isEmployeesTab(params.tab) ? params.tab : 'users';
  // Local search keeps typing responsive; the shared hook debounces it to the
  // URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value));

  // Memoized for their identity, not for speed: `useDeferredQuery` tells a
  // pending refetch by comparing references.
  const selections = useMemo<EmployeeSelections>(
    () => ({ roles: params.roles, status: params.status }),
    [params.roles, params.status],
  );
  // The tab is deferred with the funnels, so a switch keeps the old table on
  // screen (dimmed) until the new one answers, and never queries one tab with
  // the other's funnels.
  const view = useMemo(() => ({ tab, selections }), [tab, selections]);
  const { deferredFilters: shownView, deferredSearch, isPending } = useDeferredQuery(view, debouncedSearch);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const setSelections = (next: EmployeeSelections) => setParams({ roles: next.roles, status: next.status });

  const actions = [
    {
      label: 'Add Users',
      icon: <PlusCircleIcon className="h-5 w-5 text-ods-text-secondary" />,
      onClick: () => setIsAddOpen(true),
      variant: 'outline' as const,
    },
  ];

  return (
    <PageLayout
      title="Openframe"
      actions={actions}
      actionsVariant="icon-buttons"
      backButton={{ label: 'Back', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <TabNavigation
        urlSync={false}
        activeTab={tab}
        tabs={EMPLOYEES_TABS}
        onTabChange={next => setParams({ tab: next, ...NO_EMPLOYEE_SELECTIONS })}
      />
      <div style={containerStyle}>
        <SearchToolbar
          toolbarRef={toolbarRef}
          placeholder={EMPLOYEES_TAB_VIEWS[tab].search}
          value={searchInput}
          onChange={setSearchInput}
        />
        <ContentErrorBoundary
          label={EMPLOYEES_TAB_VIEWS[shownView.tab].label}
          message={`Couldn't load ${EMPLOYEES_TAB_VIEWS[shownView.tab].label.toLowerCase()}.`}
          resetKey={`${shownView.tab}:${deferredSearch}`}
        >
          {shownView.tab === 'users' ? (
            <UsersListTable
              search={deferredSearch}
              backendSelections={shownView.selections}
              selections={selections}
              onSelectionsChange={setSelections}
              isPending={isPending}
              stickyHeaderOffset={stickyHeaderOffset}
            />
          ) : (
            <InvitationsListTable
              search={deferredSearch}
              backendSelections={shownView.selections}
              selections={selections}
              onSelectionsChange={setSelections}
              isPending={isPending}
              stickyHeaderOffset={stickyHeaderOffset}
            />
          )}
        </ContentErrorBoundary>
      </div>
      <AddUsersModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        // The new invitations land on their tab, unfiltered, so none hides behind a funnel.
        onInvited={() => setParams({ tab: 'invitations', ...NO_EMPLOYEE_SELECTIONS })}
        listingIds={affectedInvitationsListings(invitationsListingId(deferredSearch))}
      />
    </PageLayout>
  );
}
