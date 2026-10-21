'use client';

import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  LoadingWhen,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';

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
      {/* The avatar switches itself in a scope: with `loading` from a prop, it is given one. */}
      <LoadingWhen loading={loading}>
        <SquareAvatar src={loading ? undefined : avatarSrc} fallback={name} size="lg" variant={avatarVariant} />
      </LoadingWhen>
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
