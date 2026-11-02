'use client';

import { IntroBannerSection, OverviewSections } from '@/app/(app)/dashboard/components/dashboard-content';
import { MingoHomeIncidents } from './mingo-home-incidents';
import { NeedsYouCard } from './needs-you/needs-you-card';

/**
 * The dashboard of the Mingo-first shell (`/dashboard` on a SaaS tenant, the sidebar's
 * Dashboard): "Needs you" (what waits for a person, gone when nothing does),
 * then the Devices / Tickets / Customers sections (their cards open the lists filtered)
 * with Incidents between Tickets and Customers. No Initial Setup card: with onboarding
 * v2 the setup is the `/setup` wizard and this page carries its welcome banner above the
 * sections; without it this shell has no onboarding. It holds no composer: the shell
 * docks one under every page, this one included, without Mingo's quick actions, which
 * are the new chat's (`/mingo`).
 */
export function MingoDashboard() {
  return (
    <div className="flex flex-col">
      {/* `empty:hidden`: the card renders nothing when nothing needs the user, and its
          padding goes with it. */}
      <div className="px-[var(--spacing-system-l)] pt-[var(--spacing-system-l)] empty:hidden">
        <NeedsYouCard />
      </div>
      <IntroBannerSection />
      <OverviewSections filterTicketLinks incidents={<MingoHomeIncidents />} dimDuringInitialSetup={false} />
    </div>
  );
}
