'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, Suspense } from 'react';
import { InitialSetupCard, InitialSetupSkeleton } from '@/app/(app)/onboarding/components/initial-setup-card';
import { useInitialSetupActive } from '@/app/(app)/onboarding/hooks/use-initial-setup-active';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isSaasTenantMode } from '@/lib/app-mode';
import { CustomersOverviewSection } from './customers-overview';
import { DevicesOverviewSection } from './devices-overview';
import { MingoIntroBanner } from './mingo-intro-banner';
import { TicketsOverviewSection } from './tickets-overview';

/** Padded wrapper for the onboarding blocks that live OUTSIDE the PageLayout chrome.
 *  `empty:hidden` collapses the wrapper (padding included) when the inner component
 *  renders `null` (dismissed walkthrough / completed setup). */
const ONBOARDING_WRAPPER_CLASS = 'px-[var(--spacing-system-l)] pt-[var(--spacing-system-l)] empty:hidden';
/** The v2 banner's wrapper: below it the same gap the PageLayout keeps between its
 *  sections, so the banner reads as one of them. */
const BANNER_WRAPPER_CLASS = `${ONBOARDING_WRAPPER_CLASS} pb-[var(--spacing-system-l)]`;

/**
 * The tenant Initial Setup card, as the classic dashboard shows it while onboarding v2
 * is off. Deliberately OUTSIDE the sections' PageLayout.
 *
 * Local Suspense so the setup card's suspending queries (e.g. DeviceSetupStep's
 * `useDeviceOrganizations`, a `useSuspenseQuery`) are caught here instead of
 * bubbling to the route-level `loading.tsx` and re-flashing the whole page skeleton.
 * Fallback is the card skeleton (not `null`) so the suspend doesn't flash an empty
 * gap between the card's own count-loading skeleton and its content — the same
 * skeleton carries through while onboarding progress (the tenant step-detection
 * round-trips) loads.
 */
function InitialSetupSection() {
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

/**
 * Onboarding v2's welcome ("OpenFrame isn't your typical RMM") above the overview,
 * until the user closes it — the dashboard's and Mingo's home's. The same wrapper as
 * the setup card, so a dismissed banner collapses the gap. Nothing while the flag is
 * unanswered or off.
 */
export function IntroBannerSection() {
  const onboardingV2 = useFeatureFlagGate('onboarding-v2');
  if (onboardingV2 !== 'on') return null;
  return (
    <div className={BANNER_WRAPPER_CLASS}>
      <MingoIntroBanner />
    </div>
  );
}

interface OverviewSectionsProps {
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
  // Gated: the card renders only once the flag answers `off`.
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
      <PageLayout className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <DevicesOverviewSection />
        {showTickets && <TicketsOverviewSection filterLinks={filterTicketLinks} />}
        {incidents}
        <CustomersOverviewSection />
      </PageLayout>
    </div>
  );
}

/**
 * The classic shell's dashboard: the v2 welcome banner or, with onboarding v2 off, the
 * Initial Setup card, then the overview sections. A v2 workspace never sees the old card
 * for a frame: it waits for the flag's answer.
 */
export default function DashboardContent() {
  const legacySetup = useFeatureFlagGate('onboarding-v2') === 'off';
  return (
    <>
      <IntroBannerSection />
      {legacySetup && <InitialSetupSection />}
      <OverviewSections />
    </>
  );
}
