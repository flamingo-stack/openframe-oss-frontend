'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { IntroBanner } from '@/app/(app)/dashboard/components/dashboard-content';
import { RevealTogether } from '@/app/components/shared/reveal-together';
import { routes } from '@/lib/routes';
import { useGreeting } from './mingo-home-greeting';
import { NeedsYouCard, NeedsYouPanel } from './needs-you/needs-you-card';

/**
 * Start Work (`/mingo` in the Manhattan v2 shell, plan D16, Figma "Start Work"): the
 * greeting, "What to ask Mingo?", the onboarding banner and "Needs you" (what waits for a
 * person: approvals, critical incidents, escalated tickets…), in one column in the middle
 * of the page. Mingo's quick actions and the composer are the docked composer's, under
 * the page, as on the Mingo-first home. The dashboard's overview sections are not here
 * (plan D15): `/dashboard` leads here in v2.
 *
 * `live` off: no reads (the shell holds the page while it waits on the onboarding answer),
 * "Needs you" in its loading form, so the hand-over moves nothing.
 */
export function ManhattanStartWork({ live = true }: { live?: boolean }) {
  const greeting = useGreeting();
  const blocks = (
    // `empty:hidden`: both render nothing when they have nothing to offer.
    <div className="flex flex-col gap-[var(--spacing-system-l)] empty:hidden">
      {live && <IntroBanner />}
      {live ? <NeedsYouCard /> : <NeedsYouPanel loading />}
    </div>
  );
  return (
    <div className="flex min-h-full flex-col justify-center px-[var(--spacing-system-l)] py-[var(--spacing-system-xl)]">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-[var(--spacing-system-l)]">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-[var(--spacing-system-m)]">
            <AgentMark agent="mingo" className="size-8 shrink-0 content-md:size-10" />
            <h1 className="min-w-0 break-words text-ods-text-primary text-h2">{greeting}</h1>
          </div>
          <p className="mt-[var(--spacing-system-xs)] text-ods-text-secondary text-h6">
            What needs doing across your fleet today?
          </p>
          <Button
            variant="outline"
            href={routes.mingo.whatToAsk}
            leftIcon={<AgentMark agent="mingo" className="size-5" />}
            className="mt-[var(--spacing-system-m)]"
          >
            What to ask Mingo?
          </Button>
        </div>
        {live ? <RevealTogether>{blocks}</RevealTogether> : blocks}
      </div>
    </div>
  );
}
