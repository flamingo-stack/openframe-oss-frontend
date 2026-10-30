'use client';

import { IntroBanner, OverviewSections } from '@/app/(app)/dashboard/components/dashboard-content';
import { MingoHomeIncidents } from './mingo-home-incidents';
import { NeedsYouCard, NeedsYouPanel } from './needs-you/needs-you-card';

/**
 * The dashboard of the Mingo-first shell (`/dashboard` on a SaaS tenant, the sidebar's
 * Dashboard): the onboarding call to book, then "Needs you" (what waits for a person,
 * gone when nothing does), then the Devices / Tickets / Customers sections (their cards
 * open the lists filtered) with Incidents between Tickets and Customers. No Initial Setup
 * card: with onboarding v2 the setup is the `/setup` wizard; without it this shell has no
 * onboarding. It holds no composer: the shell docks one under every page, this one
 * included, without Mingo's quick actions, which are the new chat's (`/mingo`).
 *
 * `live` off: no reads, what the shell holds in the page's slot in a loading scope while
 * it waits on the onboarding answer (`holdsDashboard`), so the hand-over moves nothing.
 */
export function MingoDashboard({ live = true }: { live?: boolean }) {
  return (
    <div className="flex flex-col">
      {/* `empty:hidden`: both render nothing when they have nothing to offer, and the
          padding goes with them. */}
      <div className="flex flex-col gap-[var(--spacing-system-l)] px-[var(--spacing-system-l)] pt-[var(--spacing-system-l)] empty:hidden">
        <IntroBanner />
        {live ? <NeedsYouCard /> : <NeedsYouPanel loading />}
      </div>
      <OverviewSections
        live={live}
        filterTicketLinks
        incidents={<MingoHomeIncidents />}
        dimDuringInitialSetup={false}
      />
    </div>
  );
}
