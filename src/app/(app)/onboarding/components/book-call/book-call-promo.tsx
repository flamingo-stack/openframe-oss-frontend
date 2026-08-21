'use client';

/**
 * "Book a call" promo — the offer half of {@link ./book-call-section}: copy, a
 * CTA and the walkthrough video. Presentational; the section owns the link and
 * the swap into the scheduler.
 *
 * Three layouts, switching at the same widths as the scheduler's — the two
 * share one slot, so they must change shape together:
 *   < md  phone   — stacked, CTA full width
 *   md    tablet  — stacked, CTA at content width, video below the copy
 *   lg    desktop — copy and video side by side
 *
 * Holds the scheduler's exact height (`MEETING_SCHEDULER_H`) even though its
 * copy is shorter, so the swap doesn't shove the steps below it down the page.
 * Fixed, not a floor: a floor still lets the taller side move things. The
 * leftover height goes to the video, which holds 16:9 and derives its width
 * from it.
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
        // 24 on a phone, 40 from tablet up — one token covers both stacked
        // layouts; desktop lays them side by side and takes the gap back.
        'gap-[var(--spacing-system-xl)]',
        'lg:flex-row lg:items-center lg:justify-between lg:gap-[var(--spacing-system-l)]',
        MEETING_SCHEDULER_H,
        className,
      )}
    >
      {/* `shrink-0` so the copy keeps its lines while the video absorbs the
          card's height; capped to the design's measure on desktop. */}
      <div className="flex min-w-0 shrink-0 flex-col lg:max-w-[440px]">
        {/* `xs` is 4/8 and the glyph steps with it — 16px/4px on the phone
            mock, 24px/8px on the tablet one. */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <CalendarBookmarkIcon className="size-4 shrink-0 text-ods-open-yellow md:size-6" />
          <h3 className="text-h3 text-ods-text-primary">Book an onboarding call</h3>
        </div>
        <p className="mt-[var(--spacing-system-xs)] text-h6 text-ods-text-secondary">
          Rather be walked through it? Grab a time and a specialist will set up your first customer and deploy an agent
          with you.
        </p>
        {/* Content width at every size (97px in the phone mock, not edge to
            edge) — `self-start` is what keeps it there in a column. */}
        <Button
          variant="accent"
          onClick={onBookCall}
          disabled={disabled}
          className="mt-[var(--spacing-system-l)] w-auto self-start"
        >
          Book a Call
        </Button>
      </div>

      {/* Sized by HEIGHT from tablet up: `flex-1` hands it what the copy leaves
          and 16:9 turns that into a width. `self-start` stops the column
          stretching it — a stretched item's width would win and fight the
          ratio; `max-w-full` guards the narrow card where width binds instead.
          Renders nothing when the platform has no video. */}
      <BookCallWalkthroughVideo className="w-full md:w-auto md:max-w-full md:min-h-0 md:flex-1 md:self-start lg:w-[460px] lg:flex-none lg:self-auto" />
    </section>
  );
}
