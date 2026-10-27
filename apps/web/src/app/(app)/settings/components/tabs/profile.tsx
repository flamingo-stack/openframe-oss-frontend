'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { PageError, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useState } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { authApiClient } from '@/lib/auth-api-client';
import { handleApiError } from '@/lib/handle-api-error';
import { EditProfileModal } from '../edit-profile-modal';
import { EmailVerificationModal } from '../email-verification-modal';
import { UserIdentityRow } from '../identity-row';

const CARD_CLASS = 'flex items-center gap-4 rounded-md border border-ods-border bg-ods-card p-4';
const editIcon = <PenEditIcon className="h-5 w-5" />;

export function ProfileTab() {
  const { toast } = useToast();
  const user = useAuthStore(state => state.user);
  const fetchFullProfile = useAuthStore(state => state.fetchFullProfile);
  // `/me`'s own answer, from the session query rather than the store (see `ProfileCard`).
  const { isReady: sessionResolved, isAuthenticated, user: sessionUser } = useAuthSession();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

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

  // The page is only reached in a signed-in session, so a missing user is one the session has not read yet: loading
  // until it answers (never an error card that a moment later becomes the profile). The one terminal shape is a
  // settled `/me` reporting a signed-in session with no user in it: that is an error, not a load that never ends.
  // Read from the query, not the store, for the reason `ProfileCard` gives.
  const inScope = useLoadingScope();
  const loading = inScope || !user;
  if (!inScope && !user && sessionResolved && isAuthenticated && !sessionUser) {
    return <PageError message="No user data available" />;
  }

  return (
    <div className="pt-6">
      {/* Profile card: while the profile is read, the avatar, name and email are bars; Edit Profile is fixed copy,
          drawn for real and disabled. */}
      <UserIdentityRow
        className={CARD_CLASS}
        user={user}
        loading={loading}
        onVerifyEmail={() => setIsVerificationModalOpen(true)}
        action={
          <Button variant="outline" disabled={!user} onClick={() => setIsEditModalOpen(true)} leftIcon={editIcon}>
            <span className="font-bold">Edit Profile</span>
          </Button>
        }
      />

      {user && (
        <>
          <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} user={user} />
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
