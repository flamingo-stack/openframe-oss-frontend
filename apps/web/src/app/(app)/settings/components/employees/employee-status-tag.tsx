'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InvitationStatus, UserStatus } from '@/generated/schema-enums';

type TagStyle = { label: string; variant: 'success' | 'grey' | 'warning' | 'error' };

const STATUS_TAG: Record<string, TagStyle> = {
  [UserStatus.ACTIVE]: { label: 'ACTIVE', variant: 'success' },
  // Same grey variant, distinct labels: admin-deleted vs self-deleted.
  [UserStatus.DELETED]: { label: 'DELETED', variant: 'grey' },
  [UserStatus.SELF_DELETED]: { label: 'SELF DELETED', variant: 'grey' },
  [InvitationStatus.PENDING]: { label: 'INVITE SENT', variant: 'warning' },
  [InvitationStatus.EXPIRED]: { label: 'INVITE EXPIRED', variant: 'error' },
} satisfies Record<UserStatus | InvitationStatus, TagStyle>;

/** STATUS column of both Employees tables: a user's account state or an invitation's. */
export function EmployeeStatusTag({ status }: { status: string }) {
  const { label, variant } = STATUS_TAG[status] ?? { label: status, variant: 'grey' };
  return <Tag label={label} variant={variant} />;
}
