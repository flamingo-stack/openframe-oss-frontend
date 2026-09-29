'use client';

import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { TENANT_DETAIL_TITLE, TenantDetailTitle } from './tenant-detail-title';
import { TenantSummaryCardSkeleton } from './tenant-summary-card';

/** The two entries the header settles into — the placeholders are sized off them. */
const LOADING_ACTIONS: PageActionButton[] = [{ label: 'Reconnect' }, { label: 'Edit Integration' }];

/**
 * `TenantDetailContent` while the record loads: the title as a bar, then the card with its labels
 * real and its values as bars. That is the shape both states share. What follows the card — the
 * consent hand-off of a tenant still to connect, or the integration rows of a connected one — is
 * the record's answer, so nothing stands in for it here: the integration rows are their own island
 * with their own skeleton, mounted once the state is known, and the consent card paints with the record.
 *
 * The actions are placeholders (canon `script-details-skeleton`): Reconnect and Edit are links to a
 * record the query has not confirmed yet — an unknown id settles into "Tenant not found" with no actions.
 */
export function TenantDetailSkeleton() {
  return (
    <>
      <TenantDetailTitle title={TENANT_DETAIL_TITLE} loading actions={LOADING_ACTIONS} loadingActions />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <TenantSummaryCardSkeleton />
      </div>
    </>
  );
}
