'use client';

import { Tag, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { tenantAccessCell_connection$key } from '@/__generated__/tenantAccessCell_connection.graphql';
import { accessStateTag, formatLastRead, lastReadAt } from '../../utils/tenant-presentation';

// `access` is a (TTL-cached) provider probe per row — the list is where the design shows it.
const tenantAccessCellFragment = graphql`
  fragment tenantAccessCell_connection on DirectoryConnection {
    lastSyncAt
    access {
      state
    }
  }
`;

/** ACCESS column: the access tag over "Last read: …". */
export function TenantAccessCell({ connection }: { connection: tenantAccessCell_connection$key }) {
  const data = useFragment(tenantAccessCellFragment, connection);
  // `Instant` scalars are untyped (`any`); `unknown` keeps them out of the rest of the render.
  const lastSyncAt: unknown = data.lastSyncAt;
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...accessStateTag(data.access.state)} className="self-start" />
      <TruncateText variant="h6" tone="secondary">
        {`Last read: ${formatLastRead(lastReadAt({ lastSyncAt }))}`}
      </TruncateText>
    </div>
  );
}
