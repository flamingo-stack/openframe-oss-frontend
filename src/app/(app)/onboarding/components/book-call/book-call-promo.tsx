'use client';

/**
 * "Book a call" promo — the offer half of {@link ./book-call-section}: copy and
 * a CTA, plus the walkthrough demo video. Purely presentational; the section
 * above it owns the meeting link and the swap into the scheduler.
 *
 * Rendered on BOTH onboarding surfaces (the dashboard Initial Setup card and
 * the /onboarding tour), which is why the copy lives here rather than at the
 * call sites — the two must not drift.
 *
 * THREE layouts, the same three the scheduler has, switching at the same
 * widths — the two are one slot, so they must change shape together or the
 * swap moves the page at exactly the widths between the breakpoints:
 *
 *   < md  phone   — everything stacked, CTA full width
 *   md    tablet  — stacked, CTA at its content width, video below the copy
 *   lg    desktop — copy and video side by side
 *
 * Holds the SCHEDULER's exact height (`MEETING_SCHEDULER_H`, the lib's own
 * constant) at both stated widths even though its copy is shorter: the CTA
 * replaces this card with the scheduler in place, and without one shared
 * height that swap shoves every onboarding step below it down the page and
 * yanks them back on Back. A FIXED height, not a floor — a floor still lets
 * whichever side is taller move the page.
 *
 * The leftover space goes to the VIDEO, which is the one element here that can
 * take any size without breaking: it holds 16:9 and derives its width from the
 * height it is given (`flex-1` + `w-auto`). Desktop spends the leftover
 * differently — there the card is a row, so the copy centers against a video
 * of stated width.
 */

import { CalendarBookmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { MEETING_SCHEDULER_H } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { BookCallWalkthroughVideo } from './book-call-walkthrough-video';

export interface BookCallPromoProps {
  onBookCall: () => void;
  /** No bookable link (yet) — the CTA stays in place but can't open anything. */
  disabled?: boolean;
  className?: string;
}

export function BookCallPromo({ onBookCall, disabled, className }: BookCallPromoProps) {
  return (
    <section
      className={cn(
        'flex w-full flex-col rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-l)]',
        // Copy block to video: 24 on a phone, 40 from tablet up — `xl` is that
        // ramp, so one token covers both stacked layouts. Desktop lays them
        // side by side and takes the narrower gap back.
        'gap-[var(--spacing-system-xl)]',
        'lg:flex-row lg:items-center lg:justify-between lg:gap-[var(--spacing-system-l)]',
        MEETING_SCHEDULER_H,
        className,
      )}
    >
      {/* `shrink-0` so the copy keeps its lines while the video below absorbs
          the card's height; capped to the design's measure on desktop. */}
      <div className="flex min-w-0 shrink-0 flex-col lg:max-w-[440px]">
        {/* `xs` is 4/8 and the glyph steps with it: the phone mock draws a 16px
            icon 4px from the title, the tablet one 24px and 8px. */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <CalendarBookmarkIcon className="size-4 shrink-0 text-ods-open-yellow md:size-6" />
          <h3 className="text-h3 text-ods-text-primary">Book an onboarding call</h3>
        </div>
        <p className="mt-[var(--spacing-system-xs)] text-h6 text-ods-text-secondary">
          Rather be walked through it? Grab a time and a specialist will set up your first customer and deploy an agent
          with you.
        </p>
        {/* Content width at EVERY size — the phone mock draws it 97px wide, not
            edge to edge; `self-start` is what keeps it there in a column. */}
        <Button
          variant="accent"
          onClick={onBookCall}
          disabled={disabled}
          className="mt-[var(--spacing-system-l)] w-auto self-start"
        >
          Book a Call
        </Button>
      </div>

      {/* Sized by HEIGHT from tablet up: `flex-1` hands it what the copy leaves,
          `w-auto` + the card's own 16:9 turn that into a width, and `self-start`
          keeps the column from stretching it (a stretched item's width would
          win and the ratio would fight the height). `max-w-full` is the guard
          for a narrow card, where width becomes the binding constraint again.
          On desktop it goes back to a stated column so the copy keeps its
          measure. Renders nothing when the platform has no walkthrough video —
          the copy then simply spans the card. */}
      <BookCallWalkthroughVideo className="w-full md:w-auto md:max-w-full md:min-h-0 md:flex-1 md:self-start lg:w-[460px] lg:flex-none lg:self-auto" />
    </section>
  );
}
