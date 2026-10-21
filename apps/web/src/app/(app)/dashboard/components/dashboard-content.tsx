'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { InitialSetupCard } from '@/app/(app)/onboarding/components/initial-setup-card';
import { useInitialSetupActive } from '@/app/(app)/onboarding/hooks/use-initial-setup-active';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isSaasTenantMode } from '@/lib/app-mode';
import { CustomersOverview, CustomersOverviewSection } from './customers-overview';
import { DevicesOverview, DevicesOverviewSection } from './devices-overview';
import { MingoIntroBanner } from './mingo-intro-banner';
import { TicketsOverview, TicketsOverviewSection } from './tickets-overview';

/** Padded wrapper for the onboarding blocks that live OUTSIDE the PageLayout chrome.
 *  `empty:hidden` collapses the wrapper (padding included) when the inner component
 *  renders `null` (dismissed walkthrough / completed setup). */
const ONBOARDING_WRAPPER_CLASS = 'px-[var(--spacing-system-l)] pt-[var(--spacing-system-l)] empty:hidden';
/** The v2 banner's wrapper: below it the same gap the PageLayout keeps between its
 *  sections, so the banner reads as one of them. */
const BANNER_WRAPPER_CLASS = `${ONBOARDING_WRAPPER_CLASS} pb-[var(--spacing-system-l)]`;
/** The overview sections' page chrome: PageLayout supplies the gap between sections. */
const OVERVIEWS_PAGE_CLASS = 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]';

/**
 * The dashboard: the onboarding block (the v2 welcome banner or the legacy Initial Setup card) over the three
 * overview sections. `live` reads the sections' data; without it the sections have no data and draw their own
 * loading state, which is what the app shell holds in the page slot (in a loading scope) while it waits on the
 * onboarding answer (`holdsDashboard`), so the hand-over to the real page moves nothing.
 */
export function DashboardOverviews({ live = false }: { live?: boolean }) {
  const showTickets = isSaasTenantMode();

  // Dim (and disable) the rest of the dashboard ONLY while the tenant Initial Setup is
  // active — the exact same predicate that shows the setup card and the top bar, so the
  // dimming can never appear without the card (see {@link useInitialSetupActive}). Fully
  // lit once setup is complete, before progress loads, or when there's no tenant record.
  //
  // Under onboarding v2 the Initial Setup lives on `/setup` and the dashboard is
  // never dimmed. Gated, and the card rendered only once the flag answers `off`:
  // a v2 workspace must not see the old card for a frame.
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  // While the flag is read, its likely answer's slot is kept: the flag reads as off wherever it is not registered, so
  // the legacy card's slot. The card draws nothing until the onboarding store says setup is ACTIVE, and while the
  // flag is read it draws only its loading form (it never mounts its content, so a v2 workspace never sees the old
  // card).
  const legacySetup = onboardingV2 !== 'on';
  const dimDashboard = useInitialSetupActive() && onboardingV2 === 'off';

  return (
    <>
      {/* Onboarding v2: the welcome banner in the setup card's place, until the
          user closes it. Same wrapper, so a dismissed banner collapses the gap. */}
      {onboardingV2 === 'on' && (
        <div className={BANNER_WRAPPER_CLASS}>
          <MingoIntroBanner />
        </div>
      )}
      {/* Onboarding — deliberately OUTSIDE the PageLayout below. The card owns the
          boundary for its suspending queries (e.g. DeviceSetupStep's
          `useDeviceOrganizations`) and draws its own loading state while they load. */}
      {legacySetup && (
        <div className={ONBOARDING_WRAPPER_CLASS}>
          <LoadingWhen loading={onboardingV2 === 'loading'}>
            <InitialSetupCard />
          </LoadingWhen>
        </div>
      )}
      <div
        className={cn('transition-opacity duration-300', dimDashboard && 'pointer-events-none select-none opacity-40')}
        aria-hidden={dimDashboard || undefined}
      >
        {/* Standard page chrome: PageLayout supplies the gap between sections; each
            section renders its own TitleBlock header (with the TitleBlock's own pt/mb). */}
        <PageLayout className={OVERVIEWS_PAGE_CLASS}>
          {live ? <DevicesOverviewSection /> : <DevicesOverview />}
          {showTickets && (live ? <TicketsOverviewSection /> : <TicketsOverview />)}
          {live ? <CustomersOverviewSection /> : <CustomersOverview />}
        </PageLayout>
      </div>
    </>
  );
}

/**
 * Dashboard content component - extracted for dynamic import.
 * Contains all dashboard sections: Onboarding, Devices, Tickets (SaaS only), Organizations
 */
export default function DashboardContent() {
  return <DashboardOverviews live />;
}
