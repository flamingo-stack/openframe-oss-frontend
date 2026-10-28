'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { employeeDetailsHeader_user$key } from '@/__generated__/employeeDetailsHeader_user.graphql';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { UserRole } from '@/generated/schema-enums';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { routes } from '@/lib/routes';
import { DeleteAccountModal } from '../delete-account-modal';
import { EditProfileModal } from '../edit-profile-modal';
import { ConfirmDeleteUserModal } from './confirm-delete-user-modal';
import { EMPLOYEE_DETAILS_TITLE } from './employee-details-title';

const employeeDetailsHeaderFragment = graphql`
  fragment employeeDetailsHeader_user on User {
    roles
    ...userSummaryFields_user
    ...confirmDeleteUserModal_user
  }
`;

type HeaderDialog = 'edit' | 'delete' | 'delete-account';

/**
 * The page title IS the user, with the actions menu: your own page edits your
 * profile and deletes your account (the same flow as the /settings kebab, owner
 * transfer included); another user's page deletes them — unless they are the
 * owner (the backend refuses) or already deleted. Null for an unknown id, and
 * while the record is read (a loading scope, where the title is its bar): the
 * Back button is drawn either way.
 */
export function EmployeeDetailsHeader({ user }: { user: employeeDetailsHeader_user$key | null }) {
  const loading = useLoadingScope();
  const data = useFragment(employeeDetailsHeaderFragment, user);
  const currentUser = useAuthStore(state => state.user);
  const handleBack = useSafeBack(routes.settings.employees);
  const [dialog, setDialog] = useState<HeaderDialog | null>(null);
  const backButton = { label: 'Back', onClick: handleBack };

  if (!data) {
    // In a loading scope a read title arrives as '' and the title block draws its bar.
    return <TitleBlock title={loading ? '' : EMPLOYEE_DETAILS_TITLE} backButton={backButton} />;
  }

  const { rawId, name, deleted } = toUserSummary(data);
  const isSelf = currentUser?.id === rawId;
  const disableDelete = isSelf ? deleted : data.roles.includes(UserRole.OWNER) || deleted;
  const closeDialog = () => setDialog(null);

  const menuActions = [
    ...(isSelf
      ? [
          {
            items: [
              {
                id: 'edit',
                label: 'Edit Profile',
                icon: <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />,
                onClick: () => setDialog('edit'),
              },
            ],
            separator: true,
          },
        ]
      : []),
    {
      items: [
        {
          id: isSelf ? 'delete-account' : 'delete',
          label: isSelf ? 'Delete Account' : 'Delete',
          icon: <TrashIcon className="h-5 w-5 text-ods-error" />,
          danger: true,
          disabled: disableDelete,
          onClick: () => setDialog(isSelf ? 'delete-account' : 'delete'),
        },
      ],
    },
  ];

  return (
    <>
      <TitleBlock title={name} backButton={backButton} menuActions={menuActions} />
      {isSelf ? (
        <>
          <EditProfileModal isOpen={dialog === 'edit'} onClose={closeDialog} user={currentUser} />
          <DeleteAccountModal
            open={dialog === 'delete-account'}
            onOpenChange={open => {
              if (!open) closeDialog();
            }}
          />
        </>
      ) : (
        <ConfirmDeleteUserModal user={data} isOpen={dialog === 'delete'} onClose={closeDialog} />
      )}
    </>
  );
}
