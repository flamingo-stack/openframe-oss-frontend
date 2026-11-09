'use client';

import { TenantDetailContent } from './tenant-detail-content';

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
      <TenantDetailContent id={id} loading={loading} />
    </div>
  );
}
