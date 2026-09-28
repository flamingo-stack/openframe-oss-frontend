'use client';

import { PenEditIcon, Refresh02VrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { routes } from '@/lib/routes';
import { TenantDetailContent } from './tenant-detail-content';
import { TenantDetailSkeleton } from './tenant-detail-skeleton';

function ownerActions(id: string): PageActionButton[] {
  return [
    {
      label: 'Reconnect',
      icon: <Refresh02VrIcon className="h-5 w-5" />,
      variant: 'outline',
      href: routes.settings.tenantReconnect(id),
    },
    {
      label: 'Edit Integration',
      icon: <PenEditIcon className="h-5 w-5" />,
      variant: 'outline',
      href: routes.settings.tenantEdit(id),
    },
  ];
}

interface TenantDetailViewProps {
  id: string;
  /** The module's flag has not answered yet: the frame draws, nothing fetches. */
  loading?: boolean;
}

/**
 * Tenant details. Not `PageLayout`: the title is the record, so only the island that reads it waits
 * (canon `software-detail-view`). Reconnect and Edit change the grant and binding — owners only.
 */
export function TenantDetailView({ id, loading = false }: TenantDetailViewProps) {
  const ownerGate = useOwnerGate();
  const actions = ownerGate === 'owner' ? ownerActions(id) : undefined;
  const loadingActions = ownerGate === 'loading';

  return (
    <div className="flex w-full flex-col">
      {loading ? (
        <TenantDetailSkeleton actions={actions} loadingActions={loadingActions} />
      ) : (
        <Suspense fallback={<TenantDetailSkeleton actions={actions} loadingActions={loadingActions} />}>
          <TenantDetailContent
            id={id}
            actions={actions}
            loadingActions={loadingActions}
            canCheck={ownerGate === 'owner'}
          />
        </Suspense>
      )}
    </div>
  );
}
