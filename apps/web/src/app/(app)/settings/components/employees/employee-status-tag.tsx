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

/** The status as the chip words it — the Status funnel says the same. */
export function employeeStatusLabel(status: string): string {
  return STATUS_TAG[status]?.label ?? status;
}

const NO_STATUS: TagStyle = { label: '', variant: 'grey' };

/**
 * STATUS column of both Employees tables: a user's account state or an invitation's. Null while the status is read:
 * in a loading scope a tag with no label draws its own skeleton.
 */
export function EmployeeStatusTag({ status }: { status: string | null }) {
  const { label, variant } = status === null ? NO_STATUS : (STATUS_TAG[status] ?? { label: status, variant: 'grey' });
  return <Tag label={label} variant={variant} />;
}
