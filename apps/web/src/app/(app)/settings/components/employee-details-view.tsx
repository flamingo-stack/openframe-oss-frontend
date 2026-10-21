'use client';

import { LoadError, NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SquareAvatar, Tag, TagSkeleton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import { useTrackOpenView } from '../../mingo/context/use-track-open-view';
import { useUser } from '../hooks/use-user';
import { type UserRecord, UserStatus, useDeleteUser, useUpdateProfile } from '../hooks/use-users';
import { ConfirmDeleteUserModal } from './confirm-delete-user-modal';
import { DeleteAccountModal } from './delete-account-modal';
import { EditProfileModal } from './edit-profile-modal';
import { EmployeeWorkTime } from './employee-work-time';

interface EmployeeDetailsViewProps {
  userId: string;
}

const CARD_CONTAINER =
  'flex flex-col rounded-md border border-ods-border bg-ods-card content-md:flex-row content-md:items-center content-md:gap-[var(--spacing-system-m)] content-md:p-[var(--spacing-system-m)]';

const CARD_ROW =
  'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:contents';

/**
 * The employee's card: name, email, role and status, or the deleted variant. `null` while the employee loads (or in a
 * loading scope): the same card, every cell drawing itself (`InfoCell`, the avatar), the status a tag-sized bar.
 */
function EmployeeSummary({ user, displayName }: { user: UserRecord | null; displayName: string }) {
  const loading = useLoadingScope() || user == null;
  const role = (user?.roles || []).join(', ') || EMPTY_VALUE;
  const isActive = user?.status === UserStatus.Active;

  if (!loading && user && isDeletedUserStatus(user.status)) {
    // Deleted variant per design: a single row with the red placeholder
    // avatar, the name and the status tag — the role row is dropped.
    // Admin-DELETED users keep their real name AND email (data is kept for
    // revival); SELF_DELETED users are anonymized server-side and their
    // synthetic email is hidden entirely.
    return (
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
    );
  }

  return (
    <div className={CARD_CONTAINER}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
          {/* Same responsive sizing as the deleted variant: 36px on mobile,
              48px on md+ — SquareAvatar's buckets are fixed, and its cn is
              tailwind-merge, so the className override wins. */}
          <SquareAvatar
            src={user ? getFullImageUrl(user.image?.imageUrl, user.image?.hash) : undefined}
            fallback={displayName}
            size="lg"
            variant="round"
            className="h-9 w-9 content-md:h-12 content-md:w-12"
          />
          <InfoCell loading={loading} value={displayName} label="Name" />
        </div>
        <InfoCell loading={loading} skeletonWidth="w-40" value={user?.email} label="Email" />
      </div>
      <div className={`${CARD_ROW} border-t border-ods-border`}>
        <InfoCell loading={loading} skeletonWidth="w-24" value={role} label="Role" />
        <InfoCell
          loading={loading}
          valueSkeleton={<TagSkeleton />}
          value={<Tag label={isActive ? 'ACTIVE' : 'DELETED'} variant={isActive ? 'success' : 'grey'} />}
          label="Status"
        />
      </div>
    </div>
  );
}

export function EmployeeDetailsView({ userId }: EmployeeDetailsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const handleBack = useSafeBack(routes.settings.employees);
  const currentUser = useAuthStore(state => state.user);
  const { user, isLoading, error } = useUser(userId);
  const { deleteUser } = useDeleteUser();
  const updateProfile = useUpdateProfile();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Register the open employee as the Mingo "open view". `user.id` is the raw db
  // id the backend USER resolver / `@user:id` marker expects (USER is REST-resolved
  // — no global-id round-trip). Called before the early returns to keep hooks order stable.
  useTrackOpenView(
    user
      ? {
          type: CONTEXT_ENTITY_KIND.USER,
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        }
      : null,
  );

  if (error) {
    return <LoadError message={`Error loading employee: ${error}`} />;
  }

  if (!isLoading && !user) {
    return <NotFoundError message="Employee not found" />;
  }

  // While the employee loads the title is empty and the header draws it as a bar (`loading`).
  const displayName = user
    ? user.firstName || user.lastName
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : user.email
    : '';
  const isDeleted = isDeletedUserStatus(user?.status);

  const isOwner = (user?.roles || []).some(r => r?.toLowerCase?.() === 'owner');
  const isSelf = !!currentUser && user?.id === currentUser.id;
  // Viewing YOURSELF routes into the self-deletion flow (the same
  // DeleteAccountModal as the /settings kebab — owner-transfer variant
  // included), so `isSelf` no longer disables the action. Deleting OTHERS
  // stays blocked for owners (the backend refuses) and already-deleted users.
  const disableDelete = isSelf ? isDeleted : isOwner || isDeleted;

  const handleConfirmDelete = () => {
    if (!user) return;
    deleteUser(user.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        toast({ title: 'Employee deleted', description: `${displayName} was deleted`, variant: 'success' });
        router.push(routes.settings.employees);
      },
    });
  };

  return (
    <PageLayout
      title={displayName}
      // While the employee loads: the title a bar, and the actions menu a placeholder (its items are the employee's).
      loading={isLoading}
      loadingActions={isLoading}
      backButton={{ label: 'Back', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      menuActions={
        user
          ? [
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
            ]
          : undefined
      }
    >
      <EmployeeSummary user={user ?? null} displayName={displayName} />
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
        onSave={async data => {
          await updateProfile.mutateAsync(data);
        }}
        isSaving={updateProfile.isPending}
      />
    </PageLayout>
  );
}
