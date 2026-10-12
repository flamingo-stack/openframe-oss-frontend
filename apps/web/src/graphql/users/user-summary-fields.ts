import { graphql, readInlineData } from 'react-relay';
import type { userSummaryFields_user$key } from '@/__generated__/userSummaryFields_user.graphql';
import { isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { getFullImageUrl } from '@/lib/image-url';
import { rawIdOf } from '@/lib/relay-id';

/**
 * A `User` as every surface draws it — a table cell, a picker option, a chip, an
 * incident's assignee: name, email, avatar, and whether the account is deleted.
 * One selection and one reader, so two surfaces cannot disagree on the name's
 * fallback, and no operation can drop `status` and draw a deleted user as live.
 */
export const userSummaryFieldsFragment = graphql`
  fragment userSummaryFields_user on User @inline {
    id
    firstName
    lastName
    email
    status
    image {
      imageUrl
      hash
    }
  }
`;

export interface UserSummary {
  /** The id inside the global handle — what the ticket, worktime and auth APIs speak. */
  rawId: string;
  /** The full name, else the email; empty when the record has neither. */
  name: string;
  /** Null for a self-deleted account, whose email is a placeholder. */
  email: string | null;
  avatarUrl?: string;
  /** DELETED or SELF_DELETED. */
  deleted: boolean;
  selfDeleted: boolean;
}

export function toUserSummary(ref: userSummaryFields_user$key): UserSummary {
  const { id, firstName, lastName, email, status, image } = readInlineData(userSummaryFieldsFragment, ref);
  const selfDeleted = isSelfDeletedUserStatus(status);
  return {
    rawId: rawIdOf(id),
    name: [firstName, lastName].filter(Boolean).join(' ') || email || '',
    email: selfDeleted ? null : (email ?? null),
    avatarUrl: getFullImageUrl(image?.imageUrl, image?.hash),
    deleted: isDeletedUserStatus(status),
    selfDeleted,
  };
}
