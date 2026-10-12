'use client';

import { SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { employeeDetailsSummary_user$key } from '@/__generated__/employeeDetailsSummary_user.graphql';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { EmployeeStatusTag } from '../employees/employee-status-tag';
import { CARD_CONTAINER, CARD_ROW } from './employee-details-card';

const employeeDetailsSummaryFragment = graphql`
  fragment employeeDetailsSummary_user on User {
    roles
    status
    ...userSummaryFields_user
  }
`;

/**
 * The employee card. A deleted user gets a single row per design — the red
 * placeholder avatar, the name and the status — with the role row dropped. An
 * admin-DELETED user keeps the real name AND email (the data is kept for a
 * revival); a SELF_DELETED one is anonymized server-side and its placeholder
 * email is hidden.
 */
export function EmployeeDetailsSummary({ user }: { user: employeeDetailsSummary_user$key }) {
  const data = useFragment(employeeDetailsSummaryFragment, user);
  const { name, email, avatarUrl, deleted } = toUserSummary(data);
  const status = <EmployeeStatusTag status={data.status} />;

  if (deleted) {
    return (
      <div className={CARD_CONTAINER}>
        <div className={CARD_ROW}>
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
            {/* Design sizes the placeholder responsively: 36px with a 16px icon on
                mobile, 48px with a 24px icon on md+ (1095-50238 vs 1095-46586).
                `DeletedUserAvatar` has fixed buckets only, so the container and its
                svg are overridden here instead of forking the lib component. */}
            <DeletedUserAvatar
              size="lg"
              className="h-9 w-9 content-md:h-12 content-md:w-12 [&>svg]:h-4 [&>svg]:w-4 content-md:[&>svg]:h-6 content-md:[&>svg]:w-6"
            />
            <InfoCell value={name} label="Name" />
          </div>
          {email && <InfoCell value={email} label="Email" />}
          <InfoCell value={status} label="Status" />
        </div>
      </div>
    );
  }

  return (
    <div className={CARD_CONTAINER}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
          {/* Same responsive sizing as the deleted variant: 36px on mobile,
              48px on md+ — SquareAvatar's buckets are fixed, and its cn is
              tailwind-merge, so the className override wins. */}
          <SquareAvatar
            src={avatarUrl}
            fallback={name}
            size="lg"
            variant="round"
            className="h-9 w-9 content-md:h-12 content-md:w-12"
          />
          <InfoCell value={name} label="Name" />
        </div>
        <InfoCell value={email} label="Email" />
      </div>
      <div className={`${CARD_ROW} border-t border-ods-border`}>
        <InfoCell value={data.roles.join(', ') || EMPTY_VALUE} label="Role" />
        <InfoCell value={status} label="Status" />
      </div>
    </div>
  );
}
