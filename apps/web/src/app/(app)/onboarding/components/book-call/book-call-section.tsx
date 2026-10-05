'use client';

/**
 * "Book a call" block — the promo and the scheduler it swaps to, in one slot.
 * Mounted on both the dashboard Initial Setup card and the /onboarding tour.
 *
 * The promo is HIDDEN rather than unmounted while the scheduler is up, for the
 * video inside it: unmounting drops the loaded media element, so Back repainted
 * the promo with an empty rectangle, and it released the inline claim, so the
 * app-shell floating card popped the same clip into the corner mid-form.
 */

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { BookCallPromo } from './book-call-promo';
import { BookCallScheduler } from './book-call-scheduler';
import { useOnboardingMeetingLink } from './use-onboarding-meeting-link';

export function BookCallSection({ className }: { className?: string }) {
  const { link, isLoading } = useOnboardingMeetingLink();
  const [booking, setBooking] = useState(false);

  // Settled with nothing to book → no block at all. Still in flight → the promo
  // with its CTA disabled, so nothing below shifts when the link lands.
  if (!isLoading && !link) {
    return null;
  }

  const scheduling = booking && !!link;

  return (
    <>
      <BookCallPromo
        onBookCall={() => setBooking(true)}
        disabled={!link}
        // Last in the list, so it wins over the promo's own `flex`.
        className={cn(className, scheduling && 'hidden')}
      />
      {scheduling && link && <BookCallScheduler link={link} onBack={() => setBooking(false)} className={className} />}
    </>
  );
}
