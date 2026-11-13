'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { CSSProperties } from 'react';
import { RevealTogether } from '@/app/components/shared/reveal-together';
import { routes } from '@/lib/routes';
import { GreetingText, useGreeting } from './mingo-home-greeting';
import { NeedsYouCard, NeedsYouPanel } from './needs-you/needs-you-card';

/**
 * The page is centred in the room above the docked composer, which lies over its end. `<main>`
 * makes that room (its `padding-bottom`, `--composer-dock-inset`) only once the shell has
 * measured the dock, after hydration: until then the page was centred in the whole height and
 * then moved up by half the dock (CU-17tkuw66m19). So the page keeps the dock's room itself
 * from the first paint: an upper bound of the dock's height on Start Work (its quick actions,
 * the context strip, the composer and the model row: 175px on a phone, 195px from md, where
 * its type and spacing steps up), less what `<main>` already makes. A dock lower than the bound
 * leaves the page a few pixels above the centre, but it no longer moves when the dock lands.
 * The window's `md`, not the content's: the dock is chrome under the page and follows the window.
 */
const DOCK_RESERVE_CLASS = '[--start-work-dock-reserve:175px] md:[--start-work-dock-reserve:195px]';
const CENTRED_ABOVE_DOCK: CSSProperties = {
  minHeight: 'calc(100% - max(0px, var(--start-work-dock-reserve) - var(--composer-dock-inset, 0px)))',
};

/**
 * Start Work (`/mingo` in the Manhattan v2 shell, plan D16, Figma "Start Work"): the
 * greeting, "What to ask Mingo?" and "Needs you" (what waits for a person: approvals,
 * critical incidents, escalated tickets…), in one column in the middle of the page. No
 * onboarding banner: "Book a call" lives in the onboarding guide (`/setup`) and the Help
 * Center only. Mingo's quick actions and the composer are the docked composer's, under the
 * page, as on the Mingo-first home. The dashboard's overview sections are not here (plan
 * D15): `/dashboard` leads here in v2.
 *
 * `live` off: no reads (the shell holds the page while it waits on the onboarding answer),
 * "Needs you" in its loading form, so the hand-over moves nothing.
 *
 * `variant="column"`: Start Work in the chat column beside a page when no chat is open
 * (CU-17tkuw65znp). The column has its own "Start Work" header, so the greeting is a
 * section heading there, and "What to ask Mingo?" answers in the column (`onWhatToAsk`)
 * instead of leaving the page for the chat page.
 */
export function ManhattanStartWork({
  live = true,
  variant = 'page',
  onWhatToAsk,
}: {
  live?: boolean;
  variant?: 'page' | 'column';
  /** The column's "What to ask Mingo?": shown in the column, the page stays. */
  onWhatToAsk?: () => void;
}) {
  const column = variant === 'column';
  const Heading = column ? 'h2' : 'h1';
  const greeting = useGreeting();
  return (
    <div
      className={cn(
        'flex flex-col justify-center px-[var(--spacing-system-l)] py-[var(--spacing-system-xl)]',
        column ? 'min-h-full' : DOCK_RESERVE_CLASS,
      )}
      style={column ? undefined : CENTRED_ABOVE_DOCK}
    >
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-[var(--spacing-system-l)]">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-[var(--spacing-system-m)]">
            <AgentMark agent="mingo" className="size-8 shrink-0 content-md:size-10" />
            <Heading className="min-w-0 break-words text-ods-text-primary text-h2">
              <GreetingText greeting={greeting} />
            </Heading>
          </div>
          <p className="mt-[var(--spacing-system-xs)] text-ods-text-secondary text-h6">
            What needs doing across your fleet today?
          </p>
          <Button
            variant="outline"
            href={column && onWhatToAsk ? undefined : routes.mingo.whatToAsk}
            onClick={column ? onWhatToAsk : undefined}
            leftIcon={<AgentMark agent="mingo" className="size-5" />}
            className="mt-[var(--spacing-system-m)]"
          >
            What to ask Mingo?
          </Button>
        </div>
        {live ? (
          <RevealTogether>
            <NeedsYouCard />
          </RevealTogether>
        ) : (
          <NeedsYouPanel loading />
        )}
      </div>
    </div>
  );
}
