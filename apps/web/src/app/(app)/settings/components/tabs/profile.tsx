'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { AlertCircleIcon, PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { PageError, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { apiClient } from '@/lib/api-client';
import { authApiClient } from '@/lib/auth-api-client';
import { handleApiError } from '@/lib/handle-api-error';
import { getFullImageUrl } from '@/lib/image-url';
import { EditProfileModal } from '../edit-profile-modal';
import { EmailVerificationModal } from '../email-verification-modal';
import { IdentityRow } from '../identity-row';

const CARD_CLASS = 'flex items-center gap-4 rounded-md border border-ods-border bg-ods-card p-4';
const editIcon = <PenEditIcon className="h-5 w-5" />;

export function ProfileTab() {
  const { toast } = useToast();
  const user = useAuthStore(state => state.user);
  const isLoadingProfile = useAuthStore(state => state.isLoadingProfile);
  const updateUser = useAuthStore(state => state.updateUser);
  const fetchFullProfile = useAuthStore(state => state.fetchFullProfile);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  const updateProfile = useCallback(
    async (data: { firstName: string; lastName: string }) => {
      if (!user?.id) return;

      setIsUpdating(true);
      try {
        const res = await apiClient.put<{ firstName?: string; lastName?: string }>(
          `api/users/${encodeURIComponent(user.id)}`,
          data,
        );
        if (!res.ok) {
          throw new Error(res.error || 'Failed to update profile');
        }

        // A 2xx with no body means the server accepted the change without echoing
        // it back; keep the values that were just submitted.
        const updatedData = res.data ?? data;

        // Update auth store with new data
        updateUser({
          firstName: updatedData.firstName,
          lastName: updatedData.lastName,
        });

        toast({
          title: 'Profile Updated',
          description: 'Your profile has been updated successfully.',
          variant: 'success',
          duration: 3000,
        });

        setIsEditModalOpen(false);
      } catch (error) {
        handleApiError(error, toast, 'Failed to update profile');
      } finally {
        setIsUpdating(false);
      }
    },
    [user, updateUser, toast],
  );

  const handleResendVerification = async () => {
    setIsSendingVerification(true);
    try {
      const response = await authApiClient.resendVerificationEmail(user?.email || '');

      if (!response.ok) {
        throw new Error(response.error || 'Failed to send verification email');
      }

      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox and follow the link to verify your email.',
        variant: 'success',
        duration: 5000,
      });
    } catch (error) {
      handleApiError(error, toast, 'Failed to send verification email');
    } finally {
      setIsSendingVerification(false);
    }
  };

  useEffect(() => {
    fetchFullProfile();
  }, [fetchFullProfile]);

  const loading = useLoadingScope() || (isLoadingProfile && !user);

  if (!loading && !user) {
    return (
      <div className="pt-6">
        <PageError message="No user data available" />
      </div>
    );
  }

  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '';

  return (
    <div className="pt-6">
      {/* Profile card: while the profile is read, the avatar, name and email are bars; Edit Profile is fixed copy,
          drawn for real and disabled. */}
      <IdentityRow
        className={CARD_CLASS}
        loading={loading}
        loadingLabel="Loading your profile"
        name={displayName}
        avatarSrc={user ? getFullImageUrl(user.image?.imageUrl, user.image?.hash) : undefined}
        avatarVariant="round"
        nameAside={
          user?.roles?.map(role => (
            <span
              key={role}
              className="inline-flex shrink-0 items-center rounded-md border border-ods-border bg-ods-card px-2 py-1 text-ods-text-primary text-h5"
            >
              {role}
            </span>
          )) ?? null
        }
        subline={user?.email}
        sublineWhileLoading
        sublineAside={
          user?.emailVerified === false && (
            <button
              type="button"
              onClick={() => setIsVerificationModalOpen(true)}
              className="flex items-center gap-1 text-ods-warning transition-colors hover:text-ods-warning/80"
              title="Email not verified - click to resend verification"
            >
              <AlertCircleIcon className="h-4 w-4" />
              <span className="text-h6">Not verified</span>
            </button>
          )
        }
        action={
          <Button variant="outline" disabled={!user} onClick={() => setIsEditModalOpen(true)} leftIcon={editIcon}>
            <span className="font-bold">Edit Profile</span>
          </Button>
        }
      />

      {user && (
        <>
          <EditProfileModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            user={user}
            onSave={updateProfile}
            isSaving={isUpdating}
          />
          <EmailVerificationModal
            open={isVerificationModalOpen}
            onOpenChange={setIsVerificationModalOpen}
            userEmail={user.email}
            onSubmit={handleResendVerification}
            isSending={isSendingVerification}
          />
        </>
      )}
    </div>
  );
}
