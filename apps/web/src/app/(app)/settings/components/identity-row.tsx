'use client';

import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { AlertCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  SquareAvatar,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import type { User } from '@/app/(auth)/auth/stores';
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
  /** Draw the secondary line's bar while loading: only when every record carries the line. */
  sublineWhileLoading?: boolean;
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
  sublineWhileLoading = false,
  action,
}: IdentityRowProps) {
  const loading = useLoadingScope() || loadingProp;

  const body = (
    <>
      <SquareAvatar
        src={loading ? undefined : avatarSrc}
        fallback={name}
        size="lg"
        variant={avatarVariant}
        loading={loading}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className={`flex items-center gap-2 ${nameAside === undefined ? '' : 'min-h-8'}`}>
          {loading ? (
            <TextLineSkeleton type="h4" className="w-40 max-w-full" />
          ) : (
            <>
              <div className="min-w-0">
                <TruncateText>{name}</TruncateText>
              </div>
              {nameAside}
            </>
          )}
        </div>
        {loading
          ? sublineWhileLoading && <TextLineSkeleton type="h6" className="w-56 max-w-full" />
          : subline && (
              <div className="flex items-center gap-2">
                <div className="min-w-0">
                  <TruncateText variant="h6" tone="secondary">
                    {subline}
                  </TruncateText>
                </div>
                {sublineAside}
              </div>
            )}
      </div>
      <div className="flex shrink-0 items-center gap-3">{action}</div>
    </>
  );

  return loading ? (
    <LoadingRegion label={loadingLabel} className={className}>
      {body}
    </LoadingRegion>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** The signed-in user's row frame: the profile card's, unless a caller sets its own. */
const USER_ROW_CLASS = 'flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]';

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
      action={action}
    />
  );
}
