'use client';

import { IMAGE_FIXED_PX, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getFullImageUrl } from '@/lib/image-url';

interface OrgAvatarProps {
  imageUrl?: string | null;
  hash?: string | null;
  name: string;
}

/**
 * An organization's logo in a list row: the lib's `SquareAvatar` (round, the initials when there is no logo or it
 * fails to load), at the image-size table's glyph size. `SquareAvatar` reads the URL through the authed-image hook, so
 * a bearer-mode native shell gets an authed blob URL like before.
 */
export function OrgAvatar({ imageUrl, hash, name }: OrgAvatarProps) {
  return (
    <SquareAvatar
      variant="round"
      sizePx={IMAGE_FIXED_PX.glyph}
      src={getFullImageUrl(imageUrl, hash)}
      alt={name}
      fallback={name}
      initialsClassName="text-badge text-ods-text-secondary"
    />
  );
}
