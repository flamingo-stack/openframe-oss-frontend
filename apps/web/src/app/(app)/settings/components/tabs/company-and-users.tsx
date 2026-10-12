'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useState } from 'react';
import { SoftwareSearchToolbar } from '@/app/(app)/software/components/shared/software-search-toolbar';
import { ContentErrorBoundary, TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { useInviteUsers } from '../../hooks/use-invitations';
import { AddUsersModal } from '../add-users-modal';
import { USERS_TABLE_COLUMNS } from '../employees/employees-columns';
import { InvitationsTable } from '../employees/invitations-table';
import { UsersTable } from '../employees/users-table';

const NO_FILTERS = {};

/** Settings → Employees: open invitations, then every user, both searched and paged on the server. */
export function CompanyAndUsersTab() {
  const handleBack = useSafeBack(routes.settings.root());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [invitationsFetchKey, setInvitationsFetchKey] = useState(0);
  const refreshInvitations = () => setInvitationsFetchKey(key => key + 1);
  const invite = useInviteUsers();

  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
  });
  // Local search keeps typing responsive; the shared hook debounces it to the
  // URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value));
  const { deferredSearch, isPending } = useDeferredQuery(NO_FILTERS, debouncedSearch);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const handleInviteUsers = async (rows: { email: string }[]) => {
    await invite.mutateAsync(rows.map(r => r.email));
    refreshInvitations();
  };

  const actions = [
    {
      label: 'Add Users',
      icon: <PlusCircleIcon color="var(--ods-system-greys-white)" size={20} />,
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
      <div style={containerStyle}>
        <SoftwareSearchToolbar
          toolbarRef={toolbarRef}
          placeholder="Search for Users"
          value={searchInput}
          onChange={setSearchInput}
        />
        <ContentErrorBoundary label="Invitations" message="Couldn't load invitations." resetKey={deferredSearch}>
          {/* Optional block: no placeholder, it appears with its rows or not at all. */}
          <Suspense fallback={null}>
            <InvitationsTable
              search={deferredSearch}
              isPending={isPending}
              fetchKey={invitationsFetchKey}
              onChanged={refreshInvitations}
            />
          </Suspense>
        </ContentErrorBoundary>
        <ContentErrorBoundary label="Employees" message="Couldn't load users." resetKey={deferredSearch}>
          <Suspense fallback={<TableSkeleton columns={USERS_TABLE_COLUMNS} stickyHeaderOffset={stickyHeaderOffset} />}>
            <UsersTable search={deferredSearch} isPending={isPending} stickyHeaderOffset={stickyHeaderOffset} />
          </Suspense>
        </ContentErrorBoundary>
      </div>
      <AddUsersModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} invite={handleInviteUsers} />
    </PageLayout>
  );
}
