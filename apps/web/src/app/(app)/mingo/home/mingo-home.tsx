'use client';

import { IntroBannerSection, OverviewSections } from '@/app/(app)/dashboard/components/dashboard-content';
import { MingoHomeGreeting } from './mingo-home-greeting';
import { MingoHomeIncidents } from './mingo-home-incidents';
import { NeedsYouCard } from './needs-you/needs-you-card';

/**
 * Mingo's home (`/mingo`), the Mingo-first shell's landing page: the greeting, "Needs
 * you" (what waits for a person, gone when nothing does), then the dashboard's Devices /
 * Tickets / Customers sections (their cards open the lists filtered) with Incidents
 * between Tickets and Customers. No Initial Setup card: with onboarding v2 the setup is
 * the `/setup` wizard and this page carries its welcome banner above the sections, as
 * the dashboard does; without it this shell has no onboarding. It holds no composer: the shell docks one under every page, this one included, with
 * Mingo's quick actions over it here (`MingoDockQuickActions`).
 */
export function MingoHome() {
  return (
    <div className="flex flex-col">
      <MingoHomeGreeting />
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
