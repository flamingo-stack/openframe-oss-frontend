'use client';

import { notFound } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { NotificationsPageSkeleton } from './components/notifications-page-skeleton';
import { NotificationsPageView } from './components/notifications-page-view';

export default function NotificationsPage() {
  const gate = useFeatureFlagGate('notifications');

  // Only a definitive "off" 404s. `notFound()` THROWS, so calling it while the
  // flag is merely unanswered is unrecoverable: the error boundary renders the 404
  // page and this component never re-renders to correct itself. Read as a plain
  // boolean, every refresh of this route 404'd until the flags query answered.
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'loading') {
    return <NotificationsPageSkeleton />;
  }

  return (
    <ContentErrorBoundary title="Notifications" message="Couldn't load notifications.">
      <NotificationsPageView />
    </ContentErrorBoundary>
  );
}
