'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { graphql, useFragment } from 'react-relay';
import type { tenantSyncPausedNotice_connection$key } from '@/__generated__/tenantSyncPausedNotice_connection.graphql';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { isSyncPaused, syncPausedDescription } from '../../utils/tenant-presentation';
import { TenantNotice } from './tenant-notice';

const tenantSyncPausedNoticeFragment = graphql`
  fragment tenantSyncPausedNotice_connection on DirectoryConnection {
    enabled
    syncPausedAt
    syncPausedBy {
      ...userSummaryFields_user
    }
    access {
      state
    }
  }
`;

/** "Sync is paused", who did it and when (Figma 3051-7925). Only a paused tenant has one. */
export function TenantSyncPausedNotice({ connection }: { connection: tenantSyncPausedNotice_connection$key }) {
  const data = useFragment(tenantSyncPausedNoticeFragment, connection);
  if (!isSyncPaused(data)) return null;
  const by = data.syncPausedBy ? toUserSummary(data.syncPausedBy).name : null;
  return (
    <TenantNotice
      data-loading-optional
      icon={<AlertTriangleIcon size={24} />}
      title="Sync is paused"
      description={syncPausedDescription(by, data.syncPausedAt)}
    />
  );
}
