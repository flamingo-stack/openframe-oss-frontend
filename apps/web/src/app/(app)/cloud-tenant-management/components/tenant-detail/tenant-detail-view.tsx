'use client';

import { PenEditIcon, Refresh02VrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { TenantDetailContent } from './tenant-detail-content';
import { TenantDetailSkeleton } from './tenant-detail-skeleton';

function manageActions(id: string): PageActionButton[] {
  return [
    {
      label: 'Reconnect',
      icon: <Refresh02VrIcon className="h-5 w-5 text-ods-text-secondary" />,
      variant: 'outline',
      href: routes.cloudTenantManagement.reconnect(id),
    },
    {
      label: 'Edit Integration',
      icon: <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />,
      variant: 'outline',
      href: routes.cloudTenantManagement.edit(id),
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
 * (canon `software-detail-view`).
 */
export function TenantDetailView({ id, loading = false }: TenantDetailViewProps) {
  return (
    <div className="flex w-full flex-col">
      {loading ? (
        <TenantDetailSkeleton />
      ) : (
        <Suspense fallback={<TenantDetailSkeleton />}>
          <TenantDetailContent id={id} actions={manageActions(id)} />
        </Suspense>
      )}
    </div>
  );
}
