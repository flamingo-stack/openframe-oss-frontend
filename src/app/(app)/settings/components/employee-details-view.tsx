'use client';

import { LoadError, NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Skeleton, SquareAvatar, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import { useTrackOpenView } from '../../mingo/context/use-track-open-view';
import { useUser } from '../hooks/use-user';
import { UserStatus, useDeleteUser, useUpdateProfile } from '../hooks/use-users';
import { ConfirmDeleteUserModal } from './confirm-delete-user-modal';
import { EditProfileModal } from './edit-profile-modal';
import { EmployeeWorkTime } from './employee-work-time';

interface EmployeeDetailsViewProps {
  userId: string;
}

const CARD_CONTAINER =
  'flex flex-col rounded-md border border-ods-border bg-ods-card md:flex-row md:items-center md:gap-[var(--spacing-system-m)] md:p-[var(--spacing-system-m)]';

const CARD_ROW =
  'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] md:contents';

function ProfileFieldSkeleton({ valueClassName }: { valueClassName: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[var(--spacing-system-xxs)] min-w-0">
      <Skeleton className={valueClassName} />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

function EmployeeSummarySkeleton() {
  return (
    <div className={CARD_CONTAINER}>
      <div className={CARD_ROW}>
        <div className="flex flex-1 items-center gap-[var(--spacing-system-m)] min-w-0">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <ProfileFieldSkeleton valueClassName="h-6 w-32" />
        </div>
        <ProfileFieldSkeleton valueClassName="h-6 w-40" />
      </div>
      <div className={`${CARD_ROW} border-t border-ods-border`}>
        <ProfileFieldSkeleton valueClassName="h-6 w-24" />
        <ProfileFieldSkeleton valueClassName="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

export function EmployeeDetailsView({ userId }: EmployeeDetailsViewProps) {
  const timeTrackerEnabled = useFeatureFlag('time-tracker');
  const router = useRouter();
  const { toast } = useToast();
  const handleBack = useSafeBack(routes.settings.employees);
  const currentUser = useAuthStore(state => state.user);
  const { user, isLoading, error } = useUser(userId);
  const { deleteUser } = useDeleteUser();
  const updateProfile = useUpdateProfile();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
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

  // ` ` reserves the title's h1 height while loading (PageLayout's title is
  // string-only, so the bar can't be a Skeleton) — keeps the card from jumping.
  const displayName = user
    ? user.firstName || user.lastName
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : user.email
    : ' ';
  const role = user ? (user.roles || []).join(', ') || '—' : '';
  const isActive = user?.status === UserStatus.Active;
  const isDeleted = isDeletedUserStatus(user?.status);

  const isOwner = (user?.roles || []).some(r => r?.toLowerCase?.() === 'owner');
  const isSelf = !!currentUser && user?.id === currentUser.id;
  const disableDelete = isOwner || isSelf || isDeleted;

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
                          icon: <PenEditIcon className="w-5 h-5 text-ods-text-secondary" />,
                          onClick: () => setIsEditOpen(true),
                        },
                      ],
                      separator: true,
                    },
                  ]
                : []),
              {
                items: [
                  {
                    id: 'delete',
                    label: 'Delete',
                    icon: <TrashIcon className="w-5 h-5 text-ods-error" />,
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
      {!user ? (
        <EmployeeSummarySkeleton />
      ) : isDeleted ? (
        // Deleted variant per design: a single row with the red placeholder
        // avatar, the name and the status tag — the role row is dropped.
        // Admin-DELETED users keep their real name AND email (data is kept for
        // revival); SELF_DELETED users are anonymized server-side and their
        // synthetic email is hidden entirely.
        <div className={CARD_CONTAINER}>
          <div className={CARD_ROW}>
            <div className="flex flex-1 items-center gap-[var(--spacing-system-m)] min-w-0">
              <DeletedUserAvatar size="lg" />
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
            <div className="flex flex-1 items-center gap-[var(--spacing-system-m)] min-w-0">
              <SquareAvatar
                src={getFullImageUrl(user.image?.imageUrl, user.image?.hash)}
                fallback={displayName}
                size="lg"
                variant="round"
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
      {timeTrackerEnabled && <EmployeeWorkTime userId={userId} />}
      <ConfirmDeleteUserModal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        userName={displayName}
        onConfirm={handleConfirmDelete}
      />
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
