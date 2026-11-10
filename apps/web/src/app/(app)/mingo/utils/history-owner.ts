import type { HistoricalMessage } from '@flamingo-stack/openframe-frontend-core';
import { getFullImageUrl } from '@/lib/image-url';
import type { GraphQlMessage } from '../types';

/**
 * A history row's owner as the lib's history processor takes it. The processor draws
 * `owner.user.image.imageUrl` as the author's avatar and has no field for the image's
 * `hash`, so the avatar is resolved here, with its hash, into the absolute gateway URL.
 */
export function toHistoryOwner(owner: GraphQlMessage['owner']): HistoricalMessage['owner'] {
  const image = owner.user?.image;
  if (!owner.user || !image) return owner;
  return { ...owner, user: { ...owner.user, image: { imageUrl: getFullImageUrl(image.imageUrl, image.hash) } } };
}
