'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { ArrowRightUpIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  Input,
  MoreActionsMenu,
  PageLayout,
  type Row,
  SquareAvatar,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo, useState } from 'react';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { InvitationStatus } from '../../hooks/use-invitations';
import { UserStatus } from '../../hooks/use-users';
import {
  RecordType,
  type UnifiedUserRecord,
  type UnifiedUserStatus,
  useUsersAndInvitations,
} from '../../hooks/use-users-and-invitations';
import { AddUsersModal } from '../add-users-modal';
import { ConfirmRemoveInvitationModal } from '../confirm-remove-invitation-modal';
import { ConfirmResendInvitationModal } from '../confirm-resend-invitation-modal';
import { ConfirmRevokeInvitationModal } from '../confirm-revoke-invitation-modal';

const statusToLabel = {
  [UserStatus.Active]: 'ACTIVE',
  // Same grey variant, distinct labels: admin-deleted vs self-deleted.
  [UserStatus.Deleted]: 'DELETED',
  [UserStatus.SelfDeleted]: 'SELF DELETED',
  [InvitationStatus.Pending]: 'INVITE SENT',
  [InvitationStatus.Expired]: 'INVITE EXPIRED',
} as const satisfies Record<UnifiedUserStatus, string>;

const statusToVariant = {
  [UserStatus.Active]: 'success',
  [UserStatus.Deleted]: 'grey',
  [UserStatus.SelfDeleted]: 'grey',
  [InvitationStatus.Pending]: 'warning',
  [InvitationStatus.Expired]: 'error',
} as const satisfies Record<UnifiedUserStatus, 'success' | 'grey' | 'warning' | 'error'>;

const employeeRowHref = (record: UnifiedUserRecord) =>
  record.type === RecordType.User ? employeeDetailHref(record.id) : null;

export function CompanyAndUsersTab() {
  const handleBack = useSafeBack(routes.settings.root());
  const {
    records,
    isLoading,
    error,
    revokeInvitation,
    revokeInvitationMutation,
    resendInvitation,
    resendInvitationMutation,
    inviteUsers,
    // get all users and invitations without pagination TODO: add pagination in the future
  } = useUsersAndInvitations(0, 1000);

  const [isAddOpen, setIsAddOpen] = useState(false);

  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
  });
  // Local search keeps typing responsive; the shared hook debounces it to the
  // URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: localSearch,
    setSearch: setLocalSearch,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value));
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // The full list is already on the client (fetched unpaginated above), so the
  // search filters in memory - by name or email, matching what the row shows.
  const filteredRecords = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return records;
    return records.filter(record => {
      const name = `${record.firstName || ''} ${record.lastName || ''}`.trim().toLowerCase();
      // SELF_DELETED emails are synthetic and hidden in the row - don't match them.
      const email = isSelfDeletedUserStatus(record.status) ? '' : record.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [records, debouncedSearch]);

  const [selectedInvitation, setSelectedInvitation] = useState<UnifiedUserRecord | null>(null);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isResendOpen, setIsResendOpen] = useState(false);

  const handleRevokeRequest = useCallback((record: UnifiedUserRecord) => {
    if (record.type !== RecordType.Invitation) {
      return;
    }
    setSelectedInvitation(record);
    setIsRevokeOpen(true);
  }, []);

  const handleConfirmRevoke = useCallback(async () => {
    if (!selectedInvitation || selectedInvitation.type !== RecordType.Invitation) return;
    revokeInvitation(selectedInvitation.id, {
      onSuccess: () => {
        setIsRevokeOpen(false);
        setSelectedInvitation(null);
      },
    });
  }, [selectedInvitation, revokeInvitation]);

  const handleRemoveRequest = useCallback((record: UnifiedUserRecord) => {
    if (record.type !== RecordType.Invitation) return;
    setSelectedInvitation(record);
    setIsRemoveOpen(true);
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!selectedInvitation || selectedInvitation.type !== RecordType.Invitation) return;
    revokeInvitation(selectedInvitation.id, {
      onSuccess: () => {
        setIsRemoveOpen(false);
        setSelectedInvitation(null);
      },
    });
  }, [selectedInvitation, revokeInvitation]);

  const handleResendRequest = useCallback((record: UnifiedUserRecord) => {
    if (record.type !== RecordType.Invitation) return;
    setSelectedInvitation(record);
    setIsResendOpen(true);
  }, []);

  const handleConfirmResend = useCallback(async () => {
    if (!selectedInvitation || selectedInvitation.type !== RecordType.Invitation) return;
    resendInvitation(selectedInvitation.id, {
      onSuccess: () => {
        setIsResendOpen(false);
        setSelectedInvitation(null);
      },
    });
  }, [selectedInvitation, resendInvitation]);

  const handleInviteUsers = async (rows: { email: string }[]) => {
    await inviteUsers(rows.map(r => r.email));
  };

  const columns = useMemo<ColumnDef<UnifiedUserRecord>[]>(
    () => [
      {
        accessorKey: 'user',
        header: 'USER',
        cell: ({ row }: { row: Row<UnifiedUserRecord> }) => {
          const displayName =
            row.original.firstName || row.original.lastName
              ? `${row.original.firstName || ''} ${row.original.lastName || ''}`.trim()
              : row.original.email;

          return (
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
              {isDeletedUserStatus(row.original.status) ? (
                <DeletedUserAvatar size="sm" />
              ) : (
                <SquareAvatar
                  src={getFullImageUrl(row.original.image?.imageUrl, row.original.image?.hash)}
                  fallback={displayName}
                  size="sm"
                  variant="round"
                />
              )}
              <div className="flex min-w-0 flex-col">
                <TruncateText>{displayName}</TruncateText>
                {/* SELF_DELETED emails are synthetic (`deleted-{id}@deleted.invalid`) — hidden.
                    Admin-DELETED users keep their real email (account is revivable). */}
                {!isSelfDeletedUserStatus(row.original.status) && (
                  <TruncateText variant="h6" tone="secondary" mono>
                    {row.original.email}
                  </TruncateText>
                )}
              </div>
            </div>
          );
        },
        meta: { width: 'w-1/3 max-md:flex-[3] max-md:min-w-0' },
      },
      {
        accessorKey: 'roles',
        header: 'ROLE',
        cell: ({ row }: { row: Row<UnifiedUserRecord> }) => (
          <TruncateText>{(row.original.roles || []).join(', ') || '—'}</TruncateText>
        ),
        meta: { width: 'w-1/3 max-md:flex-[2] max-md:min-w-0' },
      },
      {
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<UnifiedUserRecord> }) => {
          const statusLabel = row.original.status;
          const variant = statusToVariant[statusLabel as keyof typeof statusToVariant];
          const label = statusToLabel[statusLabel as keyof typeof statusToLabel];

          return (
            <div className="">
              <Tag label={label} variant={variant} />
            </div>
          );
        },
        meta: { width: 'w-1/3', hideAt: 'md' },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<UnifiedUserRecord> }) => {
          const record = row.original;
          if (record.type === RecordType.Invitation) {
            const isExpired = record.status === InvitationStatus.Expired;

            if (isExpired) {
              return (
                <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
                  <MoreActionsMenu
                    className="px-4"
                    items={[
                      {
                        label: 'Resend',
                        onClick: () => handleResendRequest(record),
                      },
                      {
                        label: 'Remove',
                        onClick: () => handleRemoveRequest(record),
                        danger: true,
                      },
                    ]}
                  />
                </div>
              );
            }

            return (
              <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
                <MoreActionsMenu
                  className="px-4"
                  items={[
                    {
                      label: 'Revoke',
                      onClick: () => handleRevokeRequest(record),
                      danger: true,
                    },
                  ]}
                />
              </div>
            );
          }

          return null;
        },
        enableSorting: false,
        meta: { width: 'min-w-[100px] w-auto shrink-0 flex-none', align: 'right', hideAt: 'md' },
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UnifiedUserRecord> }) => {
          if (row.original.type !== RecordType.User) {
            return null;
          }
          return (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={openInNewTab(employeeDetailHref(row.original.id))}
                variant="outline"
                size="icon"
                leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
                aria-label="Open in new tab"
                className="bg-ods-card"
              />
            </div>
          );
        },
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
    ],
    [handleRevokeRequest, handleRemoveRequest, handleResendRequest],
  );

  const table = useDataTable<UnifiedUserRecord>({
    data: filteredRecords,
    columns,
    getRowId: (row: UnifiedUserRecord) => row.id,
    enableSorting: false,
  });

  const actions = [
    {
      label: 'Add Users',
      icon: <PlusCircleIcon iconSize={20} whiteOverlay />,
      onClick: () => setIsAddOpen(true),
      variant: 'outline' as const,
    },
  ];

  const isMutating = revokeInvitationMutation.isPending || resendInvitationMutation.isPending;

  return (
    <PageLayout
      title="Openframe"
      actions={actions}
      actionsVariant="icon-buttons"
      backButton={{ label: 'Back', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div style={containerStyle}>
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]"
        >
          <Input
            placeholder="Search for Users"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
          />
        </div>
        <DataTable table={table}>
          <DataTable.Header rightSlot={<DataTable.RowCount />} stickyHeader stickyHeaderOffset={stickyHeaderOffset} />
          <DataTable.Body
            loading={isLoading || isMutating}
            emptyMessage={
              error ||
              (debouncedSearch
                ? `No users found matching "${debouncedSearch}". Try adjusting your search.`
                : 'No users or invitations found.')
            }
            rowHref={employeeRowHref}
          />
        </DataTable>
      </div>
      <ConfirmRevokeInvitationModal
        open={isRevokeOpen}
        onOpenChange={setIsRevokeOpen}
        userEmail={selectedInvitation?.email || ''}
        onConfirm={handleConfirmRevoke}
      />
      <ConfirmRemoveInvitationModal
        open={isRemoveOpen}
        onOpenChange={setIsRemoveOpen}
        userEmail={selectedInvitation?.email || ''}
        onConfirm={handleConfirmRemove}
      />
      <ConfirmResendInvitationModal
        open={isResendOpen}
        onOpenChange={setIsResendOpen}
        userEmail={selectedInvitation?.email || ''}
        onConfirm={handleConfirmResend}
      />
      <AddUsersModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} invite={handleInviteUsers} />
    </PageLayout>
  );
}
