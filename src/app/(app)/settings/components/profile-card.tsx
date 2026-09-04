'use client';

import { Skeleton, Tag } from '@flamingo-stack/openframe-frontend-core';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertCircleIcon,
  BellIcon,
  PenEditIcon,
  UserXmarkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  PageError,
  SquareAvatar,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { RotateCcw } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { getFullImageUrl } from '@/lib/image-url';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { DeleteAccountModal } from './delete-account-modal';
import { NotificationSettingsModal } from './notification-settings-modal';

interface ProfileCardProps {
  onEditProfile: () => void;
  onVerifyEmail: () => void;
}

/**
 * Placeholder for the row below, mirroring it cell for cell: same wrapper spacing, a
 * 48px round avatar (`SquareAvatar size="lg"`), the two text lines and the 44/48px kebab
 * trigger (`Button size="icon"`), so nothing moves on handoff.
 *
 * The bars take their height from the LINE BOX of the text each one stands in for —
 * `text-h4` for the name, `text-h6` for the email — rather than from a picked `h-*`
 * value. Those tokens are responsive (24/20px and 20/16px), so a fixed height can only
 * be right at one breakpoint; and the two lines are stacked block boxes in the real row,
 * with no gap between them, so a `gap-*` here shifted both bars off the text they cover.
 */
function ProfileCardSkeleton() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]" aria-busy="true">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 overflow-hidden">
        {/* `min-h-8` because the loaded name line carries role tags, and `Tag` is a fixed
            32px — taller than the 24px text line box, so IT sets the row's height (16 +
            32 + 20 + 16 = 84px). Without this the placeholder came out 80px and the row
            grew 4px on handoff. The real line below is pinned the same way so the height
            no longer depends on whether a user happens to have roles. */}
        <div className="flex min-h-8 items-center">
          <Skeleton className="h-[var(--font-size-h4-body)] w-40 max-w-full rounded-md" />
        </div>
        <div className="flex h-[var(--font-line-space-h6-caption)] items-center">
          <Skeleton className="h-[var(--font-size-h6-caption)] w-56 max-w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="h-11 w-11 shrink-0 rounded-md md:h-12 md:w-12" />
    </div>
  );
}

export function ProfileCard({ onEditProfile, onVerifyEmail }: ProfileCardProps) {
  const user = useAuthStore(state => state.user);
  // `/me`'s own answer, taken from the session query rather than the store — the `!user`
  // branch below explains why that distinction is the whole fix.
  const { isReady: sessionResolved, isAuthenticated, user: sessionUser } = useAuthSession();

  // "Reset Onboarding" replays the personal Get Started tour. Offered only when there
  // is a finished tour to replay — i.e. progress has loaded and the user has completed
  // or skipped it. While the tour is still in progress it's already in the menu, so
  // there's nothing to reset.
  const onboardingProgress = useOnboardingStore(state => state.user);
  const onboardingLoaded = useOnboardingStore(state => state.isLoaded);
  const canResetOnboarding = onboardingLoaded && !!(onboardingProgress?.completed || onboardingProgress?.skipped);
  const { resetUser, isMutating: isResettingOnboarding } = useOnboardingMutations();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '—';

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
                          icon: <RotateCcw className="h-5 w-5 text-ods-text-secondary" />,
                          onClick: () => setIsResetConfirmOpen(true),
                          disabled: isResettingOnboarding,
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

      {/* Mounted only while open: the modal's query suspends, so this both defers the
          fetch to the moment it is needed and gives it a boundary to suspend against.
          Same shape as the notifications drawer hydrator. */}
      {isNotificationSettingsOpen && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <NotificationSettingsModal onClose={() => setIsNotificationSettingsOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}

      <DeleteAccountModal open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen} />

      {/* Reset Onboarding confirmation */}
      <ConfirmDialog
        open={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
        title="Reset onboarding"
        description="This replays your Get Started tour from the beginning. Your existing data isn't affected."
        confirmLabel="Reset Onboarding"
        cancelLabel="Cancel"
        variant="warning"
        isPending={isResettingOnboarding}
        onConfirm={() => resetUser(() => setIsResetConfirmOpen(false))}
      />
    </>
  );
}
