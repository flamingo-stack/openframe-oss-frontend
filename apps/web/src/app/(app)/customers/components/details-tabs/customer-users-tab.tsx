'use client';

import { tenantPageErrorFallback } from '@/app/(app)/cloud-tenant-management/components/shared/tenant-page-error';
import { UsersView } from '@/app/(app)/users/components/users-list/users-view';
import { ContentErrorBoundary, EMBEDDED_PAGE_OFFSET } from '@/app/components/shared';

const usersTabError = tenantPageErrorFallback('Users', "Couldn't load the users.", EMBEDDED_PAGE_OFFSET);

/**
 * Customer → Users (Figma 733:98943): the directory users this customer's rules claim. Its own boundary: a failed
 * read costs this tab, not the customer page and its other tabs.
 */
export function CustomerUsersTab({ organizationId }: { organizationId: string }) {
  return (
    <ContentErrorBoundary label="CustomerUsers" resetKey={organizationId} fallback={usersTabError}>
      <UsersView organizationId={organizationId} embedded />
    </ContentErrorBoundary>
  );
}
