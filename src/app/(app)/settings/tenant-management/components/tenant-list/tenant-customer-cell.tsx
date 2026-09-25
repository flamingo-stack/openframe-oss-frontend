'use client';

import { SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { tenantCustomerCell_connection$key } from '@/__generated__/tenantCustomerCell_connection.graphql';
import { getFullImageUrl } from '@/lib/image-url';
import { usersCountLabel } from '../../utils/tenant-presentation';

const tenantCustomerCellFragment = graphql`
  fragment tenantCustomerCell_connection on DirectoryConnection {
    userCount
    organization {
      name
      image {
        imageUrl
        hash
      }
    }
  }
`;

/** CUSTOMERS column: customer logo + name over the synced user count. */
export function TenantCustomerCell({ connection }: { connection: tenantCustomerCell_connection$key }) {
  const { organization, userCount } = useFragment(tenantCustomerCellFragment, connection);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <SquareAvatar
          src={getFullImageUrl(organization.image?.imageUrl, organization.image?.hash)}
          alt={organization.name}
          fallback={organization.name}
          size="xs"
          variant="square"
        />
        <TruncateText>{organization.name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {usersCountLabel(userCount)}
      </TruncateText>
    </div>
  );
}
