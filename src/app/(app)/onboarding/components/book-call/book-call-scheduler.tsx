'use client';

/**
 * The booking half of {@link ./book-call-section}: the lib's HubSpot scheduler
 * bound to the one link this app books.
 *
 * All of the picker/booking UI is the lib's — this only supplies the link's
 * identity, points it at the `/content` proxy (the lib self-builds
 * `/api/meetings/{availability,book}` onto that base), and adds the two things
 * the lib deliberately leaves to the host: the way back to the promo, and the
 * app's own toast on a successful booking.
 */

import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type {
  BookingConfirmation,
  SchedulingLink,
} from '@flamingo-stack/openframe-frontend-core/schemas/meeting-booking-schema';
import { format } from 'date-fns';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';

export interface BookCallSchedulerProps {
  link: SchedulingLink;
  /** Back to the promo — the scheduler renders the control, the host decides. */
  onBack: () => void;
  className?: string;
}

export function BookCallScheduler({ link, onBack, className }: BookCallSchedulerProps) {
  const { toast } = useToast();

  return (
    <HubSpotMeetingScheduler
      meetingId={link.id}
      apiBaseUrl={CONTENT_BASE}
      // NO title/description on purpose: the promo the user just clicked is
      // the heading for this card, and repeating the meeting's own name under
      // the hosts pushed the timezone picker down for no new information.
      //
      // The directory already carries the display hosts, so the context panel
      // shows who you're meeting before the availability request lands.
      hosts={link.hosts}
      fallbackUrl={link.link}
      onBack={onBack}
      onBooked={(booking: BookingConfirmation) =>
        toast({
          title: 'Call booked',
          description: `${booking.title} — ${format(new Date(booking.startTimeMs), 'PPp')}. Check your email for the invite.`,
          variant: 'success',
        })
      }
      className={className}
    />
  );
}
