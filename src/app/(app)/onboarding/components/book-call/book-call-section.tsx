'use client';

/**
 * "Book a call" block on the onboarding surfaces — the promo, and the scheduler
 * it swaps to. Mounted on BOTH the dashboard Initial Setup card and the
 * /onboarding tour.
 *
 * Swap, not a dialog: the design puts the picker in the page's own flow, and
 * the lib's scheduler carries the same card chrome as the promo, so the two
 * states occupy the same slot. The scheduler's Back control returns here.
 *
 * The promo is HIDDEN rather than unmounted while the scheduler is up, which is
 * about one thing: the video inside it. Unmounting throws away a loaded media
 * element, so Back rebuilt it from nothing and the visitor watched the promo
 * come back with an empty rectangle where the video had been — a second of
 * blank card on a screen they had already seen. `display:none` keeps the
 * element, its poster and its buffer alive, so Back paints the video in the
 * same frame as the copy.
 *
 * It also keeps the inline CLAIM on the walkthrough video held for the whole
 * booking flow (see {@link InlineWalkthroughVideo}). Unmounting released it,
 * and the app-shell floating card took the clip back — so starting to book a
 * call popped a video into the corner, mid-form.
 *
 * The whole block disappears when the hub offers no scheduling link — a "Book a
 * Call" CTA with nothing behind it is worse than no promo. That is the one case
 * that DOES release the claim, so the floating card picks the clip back up.
 */

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { BookCallPromo } from './book-call-promo';
import { BookCallScheduler } from './book-call-scheduler';
import { useOnboardingMeetingLink } from './use-onboarding-meeting-link';

export function BookCallSection({ className }: { className?: string }) {
  const { link, isLoading } = useOnboardingMeetingLink();
  const [booking, setBooking] = useState(false);

  // Settled with nothing to book → no block at all. While it is still in
  // flight the promo renders with its CTA disabled rather than as a bar of
  // grey: the block keeps its place in the page, so nothing below it shifts
  // when the link lands.
  if (!isLoading && !link) {
    return null;
  }

  const scheduling = booking && !!link;

  return (
    <>
      <BookCallPromo
        onBookCall={() => setBooking(true)}
        disabled={!link}
        // `hidden` lands last, so it wins the display slot over the promo's own
        // `flex` — and takes it out of the layout AND the a11y tree, so the
        // scheduler is the only thing in the slot either way.
        className={cn(className, scheduling && 'hidden')}
      />
      {scheduling && link && <BookCallScheduler link={link} onBack={() => setBooking(false)} className={className} />}
    </>
  );
}
