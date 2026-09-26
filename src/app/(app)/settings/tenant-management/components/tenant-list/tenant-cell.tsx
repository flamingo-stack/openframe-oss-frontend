'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { tenantCell_connection$key } from '@/__generated__/tenantCell_connection.graphql';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { providerPresentation } from '../../utils/tenant-presentation';

const tenantCellFragment = graphql`
  fragment tenantCell_connection on DirectoryConnection {
    provider
    name
    domain
  }
`;

/** TENANT column: provider mark + name over the domain. */
export function TenantCell({ connection }: { connection: tenantCell_connection$key }) {
  const { provider, name, domain } = useFragment(tenantCellFragment, connection);
  const { Logo, label } = providerPresentation(provider);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <Logo size={24} role="img" aria-label={label} className="shrink-0" />
        <TruncateText>{name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {domain ?? EMPTY_VALUE}
      </TruncateText>
    </div>
  );
}
