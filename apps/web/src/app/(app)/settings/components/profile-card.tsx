'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { InteractiveSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertCircleIcon,
  BellIcon,
  PenEditIcon,
  Refresh01LeftIcon,
  UserXmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ActionsMenuDropdown, PageError, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { ResetOnboardingDialog, useCanResetOnboarding } from '@/app/components/reset-onboarding-dialog';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { getFullImageUrl } from '@/lib/image-url';
import { DeleteAccountModal } from './delete-account-modal';
import { IdentityRow } from './identity-row';
import { NotificationSettingsModal } from './notification-settings-modal';

interface ProfileCardProps {
  onEditProfile: () => void;
  onVerifyEmail: () => void;
}

const ROW_CLASS = 'flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]';

/**
 * The signed-in user's row. While the user is read, `IdentityRow` draws the 48px round avatar and the name and email
 * lines as bars (the name line's `min-h-8` is the role `Tag`'s height, so the row is one height with or without
 * roles), and the kebab is its icon-button box.
 */
export function ProfileCard({ onEditProfile, onVerifyEmail }: ProfileCardProps) {
  const inScope = useLoadingScope();
  const user = useAuthStore(state => state.user);
  // `/me`'s own answer, taken from the session query rather than the store — the `!user`
  // branch below explains why that distinction is the whole fix.
  const { isReady: sessionResolved, isAuthenticated, user: sessionUser } = useAuthSession();

  // "Reset Onboarding" replays the personal Get Started tour, when there is a finished
  // one to replay. With Mingo v2 it moves to the Mingo chat's ⋯ menu, so it is offered
  // here only once the flag has answered "off".
  const mingoV2 = useFeatureFlagGate('mingo-v2');
  const canResetOnboarding = useCanResetOnboarding() && mingoV2 === 'off';
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  // The store's `user` is written by `useAuthSession`'s effect once `/me` answers, so `!user` is simply the normal
  // state for the whole session round-trip — and `isLoadingProfile` does not cover that window: it guards the
  // *follow-up* full-profile fetch, which `fetchFullProfile` refuses to start before a user id exists. Nothing
  // blocks the app on the session any more, so treating `!user` as an error put "Page Error / No user data
  // available" in the server HTML and swapped it out on hydration — a flash on every load. `!user` is loading.
  //
  // The one genuinely terminal shape is a settled `/me` reporting a signed-in session with no user object in it.
  // Read that from the query, NOT from the store: the store is filled by an effect, so a store-based check is true
  // for the single render between the query settling and the effect committing — the same flash, one frame
  // narrower. Signed out is not an error either; the layout is already redirecting (OSS) or replacing the app
  // (SaaS), so the loading row is the correct last frame on the way out.
  const loading = inScope || !user;
  if (!inScope && !user && sessionResolved && isAuthenticated && !sessionUser) {
    return <PageError message="No user data available" />;
  }

  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '';

  return (
    <>
      <IdentityRow
        className={ROW_CLASS}
        loading={loading}
        loadingLabel="Loading your profile"
        name={displayName}
        avatarSrc={user ? getFullImageUrl(user.image?.imageUrl, user.image?.hash) : undefined}
        avatarVariant="round"
        nameAside={user?.roles?.map(role => <Tag key={role} variant="outline" label={role} />) ?? null}
        subline={user?.email}
        sublineWhileLoading
        sublineAside={
          user?.emailVerified === false && (
            <button
              type="button"
              onClick={onVerifyEmail}
              className="flex items-center gap-1 text-ods-warning transition-colors hover:text-ods-warning/80"
              title="Email not verified - click to resend verification"
            >
              <AlertCircleIcon className="h-4 w-4" />
              <span className="text-h6">Not verified</span>
            </button>
          )
        }
        action={
          loading ? (
            <InteractiveSkeleton.Button size="icon" className="shrink-0" />
          ) : (
            <ActionsMenuDropdown
              align="end"
              triggerAriaLabel="Profile actions"
              groups={[
                {
                  items: [
                    {
                      id: 'edit-profile',
                      label: 'Edit Profile',
                      icon: <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />,
                      onClick: onEditProfile,
                    },
                    {
                      id: 'notification-settings',
                      label: 'Notification Settings',
                      icon: <BellIcon className="h-5 w-5 text-ods-text-secondary" />,
                      onClick: () => setIsNotificationSettingsOpen(true),
                    },
                    ...(canResetOnboarding
                      ? [
                          {
                            id: 'reset-onboarding',
                            label: 'Reset Onboarding',
                            icon: <Refresh01LeftIcon className="h-5 w-5 text-ods-text-secondary" />,
                            onClick: () => setIsResetConfirmOpen(true),
                          },
                        ]
                      : []),
                  ],
                },
                {
                  separator: true,
                  items: [
                    {
                      id: 'delete-account',
                      label: 'Delete Account',
                      icon: <UserXmarkIcon className="h-5 w-5 text-ods-error" />,
                      danger: true,
                      onClick: () => setIsDeleteAccountOpen(true),
                    },
                  ],
                },
              ]}
            />
          )
        }
      />

      {/* Mounted only while open, so the query fires on the click rather than with the
          page. The modal carries its OWN Suspense boundary (skeleton body inside an
          already-open panel) — do not add one here, it would swallow the whole modal
          and put us back to nothing rendering until the round-trip finished. */}
      {isNotificationSettingsOpen && (
        <ErrorBoundary fallback={null /* loading-standard-ok: an error boundary's fallback, not a loading state */}>
          <NotificationSettingsModal onClose={() => setIsNotificationSettingsOpen(false)} />
        </ErrorBoundary>
      )}

      <DeleteAccountModal open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen} />

      <ResetOnboardingDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen} />
    </>
  );
}
