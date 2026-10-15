'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Suspense } from 'react';
import { InitialSetupCard, InitialSetupSkeleton } from '@/app/(app)/onboarding/components/initial-setup-card';
import { useInitialSetupActive } from '@/app/(app)/onboarding/hooks/use-initial-setup-active';
import { isSaasTenantMode } from '@/lib/app-mode';
import { CustomersOverviewSection } from './customers-overview';
import { DevicesOverviewSection } from './devices-overview';
import { TicketsOverviewSection } from './tickets-overview';

/** Padded wrapper for the onboarding blocks that live OUTSIDE the PageLayout chrome.
 *  `empty:hidden` collapses the wrapper (padding included) when the inner component
 *  renders `null` (dismissed walkthrough / completed setup). */
const ONBOARDING_WRAPPER_CLASS = 'px-[var(--spacing-system-l)] pt-[var(--spacing-system-l)] empty:hidden';

/**
 * The tenant Initial Setup card, as the dashboard shows it — and Mingo's home, which
 * renders this same block (MISSING 5.3). Deliberately OUTSIDE the sections' PageLayout.
 *
 * Local Suspense so the setup card's suspending queries (e.g. DeviceSetupStep's
 * `useDeviceOrganizations`, a `useSuspenseQuery`) are caught here instead of
 * bubbling to the route-level `loading.tsx` and re-flashing the whole page skeleton.
 * Fallback is the card skeleton (not `null`) so the suspend doesn't flash an empty
 * gap between the card's own count-loading skeleton and its content — the same
 * skeleton carries through while onboarding progress (the tenant step-detection
 * round-trips) loads.
 */
export function InitialSetupSection() {
  return (
    <Suspense
      fallback={
        <div className={ONBOARDING_WRAPPER_CLASS}>
          <InitialSetupSkeleton />
        </div>
      }
    >
      <div className={ONBOARDING_WRAPPER_CLASS}>
        <InitialSetupCard />
      </div>
    </Suspense>
  );
}

interface OverviewSectionsProps {
  /**
   * The Tickets cards open the list narrowed to their status (Mingo's home). Off: the
   * bare list, which is what the dashboard has always linked.
   */
  filterTicketLinks?: boolean;
}

/**
 * The overview sections: Devices, Tickets (SaaS only), Customers. Shared by the
 * dashboard and Mingo's home.
 */
export function OverviewSections({ filterTicketLinks = false }: OverviewSectionsProps) {
  const showTickets = isSaasTenantMode();

  // Dim (and disable) the sections ONLY while the tenant Initial Setup is active —
  // the exact same predicate that shows the setup card and the top bar, so the
  // dimming can never appear without the card (see {@link useInitialSetupActive}). Fully
  // lit once setup is complete, before progress loads, or when there's no tenant record.
  const dimSections = useInitialSetupActive();

  return (
    <div
      className={cn('transition-opacity duration-300', dimSections && 'pointer-events-none select-none opacity-40')}
      aria-hidden={dimSections || undefined}
    >
      {/* Standard page chrome: PageLayout supplies the gap between sections; each
          section renders its own TitleBlock header (with the TitleBlock's own pt/mb). */}
      <PageLayout className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <DevicesOverviewSection />
        {showTickets && <TicketsOverviewSection filterLinks={filterTicketLinks} />}
        <CustomersOverviewSection />
      </PageLayout>
    </div>
  );
}

/**
 * The classic shell's dashboard: the Initial Setup card, then the overview sections.
 */
export default function DashboardContent() {
  return (
    <>
      <InitialSetupSection />
      <OverviewSections />
    </>
  );
}
