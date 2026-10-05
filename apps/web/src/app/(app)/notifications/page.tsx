'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { NotificationsPageView } from './components/notifications-page-view';

export default function NotificationsPage() {
  return (
    <ContentErrorBoundary title="Notifications" message="Couldn't load notifications.">
      <NotificationsPageView />
    </ContentErrorBoundary>
  );
}
