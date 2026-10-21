'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { AlertCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SquareAvatar, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import type { User } from '@/app/(auth)/auth/stores';
import { TitleLines } from '@/app/components/shared/title-lines';
import { getFullImageUrl } from '@/lib/image-url';

interface IdentityRowProps {
  /** The row's frame (padding, gap, border). */
  className: string;
  /** The read data is not here yet. A loading scope does the same. */
  loading?: boolean;
  /** Announced while loading. */
  loadingLabel: string;
  /** Unread while loading; also the avatar's initials. */
  name: string;
  avatarSrc?: string;
  avatarVariant: 'round' | 'square';
  /**
   * Drawn beside the name (role tags). When given, the name line is `min-h-8`, the `Tag` height, so the row is one
   * height with or without tags and while loading.
   */
  nameAside?: ReactNode;
  /** The secondary line (an email, a website); empty draws no line once loaded. */
  subline?: string;
  /** Drawn after the secondary line once loaded (a "Not verified" button). */
  sublineAside?: ReactNode;
  /**
   * `mark`: every record carries the secondary line (its bar is drawn while loading, an empty one is the empty mark);
   * `none` (the default): only some do (no bar while loading, no line when empty).
   */
  emptySubline?: 'mark' | 'none';
  /** The trailing action; the caller draws it real and disabled (or its own placeholder) while loading. */
  action: ReactNode;
}

/**
 * One identity row (avatar, name, secondary line, action) for the settings cards: the profile card, the profile tab
 * and the organization card. It switches per value: while loading the avatar draws its own 48px loading box
 * of the same variant and the name and secondary line are bars of their own type steps.
 */
export function IdentityRow({
  className,
  loading: loadingProp = false,
  loadingLabel,
  name,
  avatarSrc,
  avatarVariant,
  nameAside,
  subline,
  sublineAside,
  emptySubline = 'none',
  action,
}: IdentityRowProps) {
  const loading = useLoadingScope() || loadingProp;

  return (
    <LoadingRegion announce={loading} label={loadingLabel} className={className}>
      <SquareAvatar
        src={loading ? undefined : avatarSrc}
        fallback={name}
        size="lg"
        variant={avatarVariant}
        loading={loading}
      />
      <TitleLines
        className="flex-1 overflow-hidden"
        loading={loading}
        title={name}
        titleAside={nameAside}
        titleClassName={nameAside === undefined ? undefined : 'min-h-8'}
        titleSkeletonWidth="w-40"
        subline={subline}
        sublineAside={sublineAside}
        sublineSkeletonWidth="w-56"
        emptySubline={emptySubline}
      />
      <div className="flex shrink-0 items-center gap-3">{action}</div>
    </LoadingRegion>
  );
}

/** An identity row's frame on the settings cards: the profile card's and the organization card's. */
export const USER_ROW_CLASS = 'flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]';

interface UserIdentityRowProps {
  /** The signed-in user; `null` while it is read. */
  user: User | null;
  loading: boolean;
  /** Opens the email verification flow from the "Not verified" button. */
  onVerifyEmail: () => void;
  action: ReactNode;
  className?: string;
}

/**
 * The signed-in user's identity row, the same on the profile card and the profile tab: the round avatar, the display
 * name (the email when there is none) with a lib `Tag` per role, the email and, while it is unverified, the button
 * that resends the verification.
 */
export function UserIdentityRow({
  user,
  loading,
  onVerifyEmail,
  action,
  className = USER_ROW_CLASS,
}: UserIdentityRowProps) {
  const displayName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '';
  return (
    <IdentityRow
      className={className}
      loading={loading}
      loadingLabel="Loading your profile"
      name={displayName}
      avatarSrc={user ? getFullImageUrl(user.image?.imageUrl, user.image?.hash) : undefined}
      avatarVariant="round"
      nameAside={user?.roles?.map(role => <Tag key={role} variant="outline" label={role} />) ?? null}
      subline={user?.email}
      emptySubline="mark"
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
      action={action}
    />
  );
}
