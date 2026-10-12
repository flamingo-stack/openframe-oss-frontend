'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SquareAvatar, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { employeeDetailsContentDeleteMutation } from '@/__generated__/employeeDetailsContentDeleteMutation.graphql';
import type { employeeDetailsContentQuery } from '@/__generated__/employeeDetailsContentQuery.graphql';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { UserRole, UserStatus } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { getFullImageUrl } from '@/lib/image-url';
import { rawIdOf, toGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import { useTrackOpenView } from '../../mingo/context/use-track-open-view';
import { useUpdateOwnProfile } from '../hooks/use-update-own-profile';
import { ConfirmDeleteUserModal } from './confirm-delete-user-modal';
import { DeleteAccountModal } from './delete-account-modal';
import { EditProfileModal } from './edit-profile-modal';
import { CARD_CONTAINER, CARD_ROW } from './employee-details-layout';
import { EmployeeWorkTime } from './employee-work-time';

const employeeDetailsContentQueryNode = graphql`
  query employeeDetailsContentQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        id
        firstName
        lastName
        email
        status
        roles
        image {
          imageUrl
          hash
        }
      }
    }
  }
`;

const deleteUserMutation = graphql`
  mutation employeeDetailsContentDeleteMutation($id: ID!) {
    deleteUser(input: { id: $id }) {
      user {
        id
        status
      }
    }
  }
`;

interface EmployeeDetailsContentProps {
  /** Raw user id, as the route carries it. */
  userId: string;
  onBack: () => void;
}

export function EmployeeDetailsContent({ userId, onBack }: EmployeeDetailsContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAuthStore(state => state.user);
  const data = useLazyLoadQuery<employeeDetailsContentQuery>(
    employeeDetailsContentQueryNode,
    { id: toGlobalId('User', userId) },
    { fetchPolicy: 'store-and-network' },
  );
  const [commitDelete] = useMutation<employeeDetailsContentDeleteMutation>(deleteUserMutation);
  const { updateProfile, isUpdating } = useUpdateOwnProfile();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const user = data.node?.__typename === 'User' ? data.node : null;

  // Register the open employee as the Mingo "open view": the USER resolver and the
  // `@user:id` marker take the raw id.
  useTrackOpenView(
    user
      ? {
          type: CONTEXT_ENTITY_KIND.USER,
          id: rawIdOf(user.id),
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '',
        }
      : null,
  );

  if (!user) {
    return <NotFoundError message="Employee not found" />;
  }

  const displayName =
    user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (user.email ?? '');
  const role = user.roles.join(', ') || EMPTY_VALUE;
  const isActive = user.status === UserStatus.ACTIVE;
  const isDeleted = isDeletedUserStatus(user.status);
  const isOwner = user.roles.includes(UserRole.OWNER);
  const isSelf = !!currentUser && rawIdOf(user.id) === currentUser.id;
  // Viewing YOURSELF routes into the self-deletion flow (the same
  // DeleteAccountModal as the /settings kebab — owner-transfer variant
  // included), so `isSelf` no longer disables the action. Deleting OTHERS
  // stays blocked for owners (the backend refuses) and already-deleted users.
  const disableDelete = isSelf ? isDeleted : isOwner || isDeleted;

  const handleConfirmDelete = () => {
    commitDelete({
      variables: { id: user.id },
      onCompleted: () => {
        setIsDeleteOpen(false);
        toast({ title: 'Employee deleted', description: `${displayName} was deleted`, variant: 'success' });
        router.push(routes.settings.employees);
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to delete user'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <PageLayout
      title={displayName}
      backButton={{ label: 'Back', onClick: onBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      menuActions={[
        ...(isSelf
          ? [
              {
                items: [
                  {
                    id: 'edit',
                    label: 'Edit Profile',
                    icon: <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />,
                    onClick: () => setIsEditOpen(true),
                  },
                ],
                separator: true,
              },
            ]
          : []),
        {
          items: [
            isSelf
              ? {
                  id: 'delete-account',
                  label: 'Delete Account',
                  icon: <TrashIcon className="h-5 w-5 text-ods-error" />,
                  danger: true,
                  disabled: disableDelete,
                  onClick: () => setIsDeleteAccountOpen(true),
                }
              : {
                  id: 'delete',
                  label: 'Delete',
                  icon: <TrashIcon className="h-5 w-5 text-ods-error" />,
                  danger: true,
                  disabled: disableDelete,
                  onClick: () => setIsDeleteOpen(true),
                },
          ],
        },
      ]}
    >
      {isDeleted ? (
        // Deleted variant per design: a single row with the red placeholder
        // avatar, the name and the status tag — the role row is dropped.
        // Admin-DELETED users keep their real name AND email (data is kept for
        // revival); SELF_DELETED users are anonymized server-side and their
        // synthetic email is hidden entirely.
        <div className={CARD_CONTAINER}>
          <div className={CARD_ROW}>
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
              {/* Design sizes the placeholder responsively: 36px with a 16px icon on
                  mobile, 48px with a 24px icon on md+ (1095-50238 vs 1095-46586).
                  `DeletedUserAvatar` has fixed buckets only, so the container and its
                  svg are overridden here instead of forking the lib component. */}
              <DeletedUserAvatar
                size="lg"
                className="h-9 w-9 content-md:h-12 content-md:w-12 [&>svg]:h-4 [&>svg]:w-4 content-md:[&>svg]:h-6 content-md:[&>svg]:w-6"
              />
              <InfoCell value={displayName} label="Name" />
            </div>
            {!isSelfDeletedUserStatus(user.status) && <InfoCell value={user.email} label="Email" />}
            <InfoCell
              value={<Tag label={isSelfDeletedUserStatus(user.status) ? 'SELF DELETED' : 'DELETED'} variant="grey" />}
              label="Status"
            />
          </div>
        </div>
      ) : (
        <div className={CARD_CONTAINER}>
          <div className={CARD_ROW}>
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
              {/* Same responsive sizing as the deleted variant: 36px on mobile,
                  48px on md+ — SquareAvatar's buckets are fixed, and its cn is
                  tailwind-merge, so the className override wins. */}
              <SquareAvatar
                src={getFullImageUrl(user.image?.imageUrl, user.image?.hash)}
                fallback={displayName}
                size="lg"
                variant="round"
                className="h-9 w-9 content-md:h-12 content-md:w-12"
              />
              <InfoCell value={displayName} label="Name" />
            </div>
            <InfoCell value={user.email} label="Email" />
          </div>
          <div className={`${CARD_ROW} border-t border-ods-border`}>
            <InfoCell value={role} label="Role" />
            <InfoCell
              value={<Tag label={isActive ? 'ACTIVE' : 'DELETED'} variant={isActive ? 'success' : 'grey'} />}
              label="Status"
            />
          </div>
        </div>
      )}
      <EmployeeWorkTime userId={userId} />
      <ConfirmDeleteUserModal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        userName={displayName}
        onConfirm={handleConfirmDelete}
      />
      {/* Self-deletion flow — the same modal the /settings profile kebab opens,
          with the owner-transfer variant and the /account-deleted hand-off. */}
      {isSelf && <DeleteAccountModal open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen} />}
      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={currentUser}
        onSave={updateProfile}
        isSaving={isUpdating}
      />
    </PageLayout>
  );
}
