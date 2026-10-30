'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
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
 * The tenant Initial Setup card, as the classic dashboard shows it while onboarding v2
 * is off. Deliberately OUTSIDE the sections' PageLayout. The card owns the boundary for
 * its suspending queries (e.g. DeviceSetupStep's `useDeviceOrganizations`) and draws its
 * own loading state while they load.
 *
 * While the flag is read, its likely answer's slot is kept: the flag reads as off wherever
 * it is not registered, so the legacy card's slot. The card draws nothing until the
 * onboarding store says setup is ACTIVE, and while the flag is read it draws only its
 * loading form (it never mounts its content, so a v2 workspace never sees the old card).
 */
function InitialSetupSection() {
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  if (onboardingV2 === 'on') return null;
  return (
    <div className={ONBOARDING_WRAPPER_CLASS}>
      <LoadingWhen loading={onboardingV2 === 'loading'}>
        <InitialSetupCard />
      </LoadingWhen>
    </div>
  );
}

/**
 * Onboarding v2's welcome ("OpenFrame isn't your typical RMM"), until the user closes it.
 * Nothing with the flag off. While it is unanswered a SaaS tenant, which is where the flag
 * is on, keeps the banner's place in its loading form; an OSS tenant, where it reads as
 * off, keeps nothing.
 */
export function IntroBanner() {
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  const shows = isSaasTenantMode() ? onboardingV2 !== 'off' : onboardingV2 === 'on';
  return shows ? <MingoIntroBanner loading={onboardingV2 === 'loading'} /> : null;
}

/** The banner above the classic overview: the setup card's wrapper, so a dismissed banner collapses the gap. */
function IntroBannerSection() {
  return (
    <div className={BANNER_WRAPPER_CLASS}>
      <IntroBanner />
    </div>
  );
}

interface OverviewSectionsProps {
  /**
   * Read the sections' data (default). Off: the sections have no data and draw their own
   * loading state, which is what the app shell holds in the page slot (in a loading scope)
   * while it waits on the onboarding answer (`holdsDashboard`), so the hand-over to the
   * real page moves nothing.
   */
  live?: boolean;
  /**
   * The Tickets cards open the list narrowed to their status (Mingo's home). Off: the
   * bare list, which is what the dashboard has always linked.
   */
  filterTicketLinks?: boolean;
  /**
   * A section between Tickets and Customers — Mingo's home puts its Incidents here. Inside
   * the same PageLayout and dimming as the rest, so it spaces and dims like them.
   */
  incidents?: ReactNode;
  /**
   * Dim the sections while the tenant Initial Setup runs — the dashboard, which shows the
   * setup card above them. Mingo's home has no setup card, so no dimming. Default true.
   */
  dimDuringInitialSetup?: boolean;
}

/**
 * The overview sections: Devices, Tickets (SaaS only), Customers. Shared by the
 * dashboard and Mingo's home.
 */
export function OverviewSections({
  live = true,
  filterTicketLinks = false,
  incidents,
  dimDuringInitialSetup = true,
}: OverviewSectionsProps) {
  const showTickets = isSaasTenantMode();

  // Dim (and disable) the sections ONLY while the tenant Initial Setup is active —
  // the exact same predicate that shows the setup card and the top bar, so the
  // dimming can never appear without the card (see {@link useInitialSetupActive}). Fully
  // lit once setup is complete, before progress loads, or when there's no tenant record.
  //
  // Under onboarding v2 the Initial Setup lives on `/setup` and nothing is dimmed.
  // Gated: dimmed only once the flag answers `off`.
  const legacySetup = useFeatureFlagGate('onboarding-v2') === 'off';
  const setupActive = useInitialSetupActive();
  const dimSections = dimDuringInitialSetup && legacySetup && setupActive;

  return (
    <div
      className={cn('transition-opacity duration-300', dimSections && 'pointer-events-none select-none opacity-40')}
      aria-hidden={dimSections || undefined}
    >
      {/* Standard page chrome: PageLayout supplies the gap between sections; each
          section renders its own TitleBlock header (with the TitleBlock's own pt/mb). */}
      <PageLayout className={OVERVIEWS_PAGE_CLASS}>
        {live ? <DevicesOverviewSection /> : <DevicesOverview />}
        {showTickets && (live ? <TicketsOverviewSection filterLinks={filterTicketLinks} /> : <TicketsOverview />)}
        {incidents}
        {live ? <CustomersOverviewSection /> : <CustomersOverview />}
      </PageLayout>
    </div>
  );
}

/**
 * The classic shell's dashboard: the v2 welcome banner or, with onboarding v2 off, the
 * Initial Setup card, then the overview sections. `live` reads the sections' data;
 * without it they draw their own loading state (see {@link OverviewSectionsProps.live}).
 */
export function DashboardOverviews({ live = false }: { live?: boolean }) {
  return (
    <>
      <IntroBannerSection />
      <InitialSetupSection />
      <OverviewSections live={live} />
    </>
  );
}

/** The dashboard page's content: the overviews over their data. */
export default function DashboardContent() {
  return <DashboardOverviews live />;
}
