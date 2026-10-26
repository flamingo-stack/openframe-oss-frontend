'use client';

import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { BookingConfirmation } from '@flamingo-stack/openframe-frontend-core/schemas/meeting-booking-schema';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';
import { useOnboardingMeetingLink } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { formatDateTime } from '@/lib/format-date';

/**
 * "Book an Onboarding Call": the lib's HubSpot scheduler on the hub's onboarding
 * link, in a modal - its modal layout (host strip, timezone, calendar beside the
 * times, Continue under the card), which the 600px window has the room for.
 * Same link and same booked toast as the dashboard promo's inline scheduler;
 * the modal closes on a confirmed booking, and on a phone's Cancel.
 */
export function BookCallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { link, isLoading } = useOnboardingMeetingLink();

  return (
    <SimpleModal
      isOpen={open}
      onClose={onClose}
      title="Book an Onboarding Call"
      className="md:max-w-[600px]"
      // The window scrolls as a whole on a phone (the scheduler's footer rides
      // with the card); without this slot the body has no scroll box at all.
      contentClassName="flex flex-col"
    >
      {link || isLoading ? (
        // While the link is read the scheduler draws its own loading state, in the same tree, so nothing remounts
        // when the link lands.
        <LoadingWhen loading={!link}>
          <HubSpotMeetingScheduler
            layout="modal"
            meetingId={link?.id ?? ''}
            apiBaseUrl={CONTENT_BASE}
            hosts={link?.hosts}
            fallbackUrl={link?.link}
            onBack={onClose}
            onBooked={(booking: BookingConfirmation) => {
              toast({
                title: 'Call booked',
                description: `${booking.title} - ${formatDateTime(booking.startTimeMs)}. Check your email for the invite.`,
                variant: 'success',
              });
              onClose();
            }}
          />
        </LoadingWhen>
      ) : (
        <p className="text-ods-text-secondary text-h4">No onboarding calls can be booked right now.</p>
      )}
    </SimpleModal>
  );
}
