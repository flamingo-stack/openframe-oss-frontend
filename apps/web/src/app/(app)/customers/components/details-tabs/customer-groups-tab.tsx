'use client';

import { tenantPageErrorFallback } from '@/app/(app)/cloud-tenant-management/components/shared/tenant-page-error';
import { GroupsView } from '@/app/(app)/users/components/groups-list/groups-view';
import { ContentErrorBoundary, EMBEDDED_PAGE_OFFSET } from '@/app/components/shared';

const groupsTabError = tenantPageErrorFallback('Groups', "Couldn't load the groups.", EMBEDDED_PAGE_OFFSET);

/**
 * Customer → Groups (Figma 733:99271): the directory groups that touch this customer. Its own boundary: a failed read
 * costs this tab, not the customer page and its other tabs.
 */
export function CustomerGroupsTab({ organizationId }: { organizationId: string }) {
  return (
    <ContentErrorBoundary label="CustomerGroups" resetKey={organizationId} fallback={groupsTabError}>
      <GroupsView organizationId={organizationId} />
    </ContentErrorBoundary>
  );
}
