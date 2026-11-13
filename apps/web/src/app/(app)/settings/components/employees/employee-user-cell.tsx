'use client';

import {
  DataTable,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { employeeUserCell_user$key } from '@/__generated__/employeeUserCell_user.graphql';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { toUserSummary } from '@/graphql/users/user-summary-fields';

const employeeUserCellFragment = graphql`
  fragment employeeUserCell_user on User {
    ...userSummaryFields_user
  }
`;

/** USER column: avatar, name, and the email underneath. */
export function EmployeeUserCell({ user }: { user: employeeUserCell_user$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(employeeUserCellFragment, useLoadingScope() ? null : user);
  const summary = data ? toUserSummary(data) : null;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      {summary?.deleted ? (
        <DeletedUserAvatar size="sm" />
      ) : (
        <SquareAvatar src={summary?.avatarUrl} fallback={summary?.name ?? ''} size="sm" variant="round" />
      )}
      <div className="flex min-w-0 flex-col">
        <TruncateText>{summary?.name ?? ''}</TruncateText>
        {/* Null for a self-deleted user, whose email is a placeholder; an admin-deleted one keeps the real email. */}
        {summary?.email !== null && (
          <TruncateText variant="h6" tone="secondary" mono>
            {summary?.email ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/**
 * USER column in the grid layout: one line, the avatar, the name and the email after it (the name gives way first when
 * the column is narrow).
 */
export function EmployeeUserGridCell({ user }: { user: employeeUserCell_user$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(employeeUserCellFragment, useLoadingScope() ? null : user);
  const summary = data ? toUserSummary(data) : null;
  const name = summary?.name ?? '';
  // Null for a self-deleted user, whose email is a placeholder; an admin-deleted one keeps the real email.
  const email = summary?.email ?? undefined;

  if (summary?.deleted) {
    // The deleted mark is not one of the cell's leading kinds: it sits before the cell, on the same line.
    return (
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
        <DeletedUserAvatar size="sm" />
        <DataTable.Cell text={name} secondary={email} />
      </div>
    );
  }
  return <DataTable.Cell leading={{ type: 'avatar', src: summary?.avatarUrl, name }} text={name} secondary={email} />;
}
