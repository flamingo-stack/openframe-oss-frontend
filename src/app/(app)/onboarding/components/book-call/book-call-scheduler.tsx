'use client';

/**
 * The booking half of {@link ./book-call-section}: the lib's HubSpot scheduler
 * bound to the one link this app books. All picker UI is the lib's; this adds
 * the link identity, the `/content` proxy base, and the two things the lib
 * leaves to the host — the way back, and the booked toast.
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
      // No title/description: the promo the user just clicked is this card's
      // heading, and repeating the meeting name only pushed the picker down.
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
