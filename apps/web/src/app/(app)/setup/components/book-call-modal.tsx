'use client';

import { MeetingSchedulerModal } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';
import { useOnboardingMeetingLink } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';

/**
 * "Book an Onboarding Call": the lib's booking window on the hub's onboarding
 * link. The window, the scheduler inside it and the booked toast are the lib's;
 * this binds the title, the link this app books and the `/content` proxy base.
 */
export function BookCallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { link, isLoading } = useOnboardingMeetingLink();

  return (
    <MeetingSchedulerModal
      isOpen={open}
      onClose={onClose}
      title="Book an Onboarding Call"
      link={link}
      loading={isLoading}
      apiBaseUrl={CONTENT_BASE}
      emptyMessage="No onboarding calls can be booked right now."
    />
  );
}
