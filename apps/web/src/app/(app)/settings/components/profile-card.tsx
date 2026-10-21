'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import {
  InteractiveSkeleton,
  LoadingRegion,
  TextLineSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertCircleIcon,
  BellIcon,
  PenEditIcon,
  Refresh01LeftIcon,
  UserXmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  PageError,
  SquareAvatar,
  SquareAvatarSkeleton,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { ResetOnboardingDialog, useCanResetOnboarding } from '@/app/components/reset-onboarding-dialog';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { getFullImageUrl } from '@/lib/image-url';
import { DeleteAccountModal } from './delete-account-modal';
import { NotificationSettingsModal } from './notification-settings-modal';

interface ProfileCardProps {
  onEditProfile: () => void;
  onVerifyEmail: () => void;
}

/**
 * The row while the user is read, cell for cell: the 48px round avatar (`SquareAvatar size="lg"`), the name line (its
 * `min-h-8` is the role `Tag`'s height, so the row is one height with or without roles) and the email line as bars of
 * their own type steps, and the kebab trigger's icon-button box.
 */
function ProfileCardSkeleton() {
  return (
    <LoadingRegion
      label="Loading your profile"
      className="flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]"
    >
      <SquareAvatarSkeleton size="lg" variant="round" className="shrink-0" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-h-8 items-center">
          <TextLineSkeleton type="h4" className="w-40 max-w-full" />
        </div>
        <TextLineSkeleton type="h6" className="w-56 max-w-full" />
      </div>
      <InteractiveSkeleton.Button size="icon" className="shrink-0" />
    </LoadingRegion>
  );
}

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

  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : EMPTY_VALUE;

  if (inScope) return <ProfileCardSkeleton />;
  if (!user) {
    // Two situations this used to conflate.
    //
    // The store's `user` is written by `useAuthSession`'s effect once `/me` answers, so
    // `!user` is simply the normal state for the whole session round-trip — and
    // `isLoadingProfile` does not cover that window: it guards the *follow-up* full-profile
    // fetch, which `fetchFullProfile` refuses to start before a user id exists. It therefore
    // reads `false` both before and after, so the old `isLoadingProfile && !user` skeleton
    // condition was false exactly when the data was most missing, and the error below owned
    // the window. That was invisible back when a root gate blocked the app until the
    // session and flags resolved; nothing blocks now, so this body renders immediately and
    // "Page Error / No user data available" lands in the server HTML and is swapped out on
    // hydration — a flash on every load.
    //
    // The one genuinely terminal shape is a settled `/me` reporting a signed-in session with
    // no user object in it. Read that from the query, NOT from the store: the store is filled
    // by an effect, so a store-based check is true for the single render between the query
    // settling and the effect committing — the same flash, one frame narrower. Signed out is
    // not an error either; the layout is already redirecting (OSS) or replacing the app
    // (SaaS), so a placeholder is the correct last frame on the way out.
    if (sessionResolved && isAuthenticated && !sessionUser) {
      return <PageError message="No user data available" />;
    }
    return <ProfileCardSkeleton />;
  }

  return (
    <>
      <div className="flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        <SquareAvatar
          src={getFullImageUrl(user.image?.imageUrl, user.image?.hash)}
          fallback={displayName}
          size="lg"
          variant="round"
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          {/* `min-h-8` = the `Tag` height, so this line is 32px whether or not the user
              has role tags. It is what makes the row a constant 84px and lets the
              placeholder above match it instead of guessing at a role count. */}
          <div className="flex min-h-8 items-center gap-2">
            <div className="min-w-0">
              <TruncateText>{displayName}</TruncateText>
            </div>
            {user.roles?.map(role => (
              <Tag key={role} variant="outline" label={role} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <TruncateText variant="h6" tone="secondary">
                {user.email}
              </TruncateText>
            </div>
            {user.emailVerified === false && (
              <button
                type="button"
                onClick={onVerifyEmail}
                className="flex items-center gap-1 text-ods-warning transition-colors hover:text-ods-warning/80"
                title="Email not verified - click to resend verification"
              >
                <AlertCircleIcon className="h-4 w-4" />
                <span className="text-h6">Not verified</span>
              </button>
            )}
          </div>
        </div>

        {/* Action menu — Edit Profile + (flag-gated) Reset Onboarding, per the design's "…" kebab */}
        <div className="flex shrink-0 items-center gap-3">
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
        </div>
      </div>

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
