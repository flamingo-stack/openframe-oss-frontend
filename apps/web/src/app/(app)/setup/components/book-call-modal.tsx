'use client';

import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { BookingConfirmation } from '@flamingo-stack/openframe-frontend-core/schemas/meeting-booking-schema';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';
import { useOnboardingMeetingLink } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { formatDateTime } from '@/lib/format-date';

/**
 * "Book an Onboarding Call": the lib's HubSpot scheduler on the hub's onboarding
 * link, in a modal. Same link and same booked toast as the dashboard promo's
 * inline scheduler; the modal closes on a confirmed booking.
 */
export function BookCallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { link, isLoading } = useOnboardingMeetingLink();

  return (
    <SimpleModal isOpen={open} onClose={onClose} title="Book an Onboarding Call" className="md:max-w-[600px]">
      {link ? (
        <HubSpotMeetingScheduler
          meetingId={link.id}
          apiBaseUrl={CONTENT_BASE}
          hosts={link.hosts}
          fallbackUrl={link.link}
          onBooked={(booking: BookingConfirmation) => {
            toast({
              title: 'Call booked',
              description: `${booking.title} - ${formatDateTime(booking.startTimeMs)}. Check your email for the invite.`,
              variant: 'success',
            });
            onClose();
          }}
        />
      ) : isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-md" />
      ) : (
        <p className="text-ods-text-secondary text-h4">No onboarding calls can be booked right now.</p>
      )}
    </SimpleModal>
  );
}
