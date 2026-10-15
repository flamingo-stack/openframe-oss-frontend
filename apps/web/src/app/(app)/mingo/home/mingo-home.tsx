'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { InitialSetupSection, OverviewSections } from '@/app/(app)/dashboard/components/dashboard-content';
import { MingoHomeGreeting } from './mingo-home-greeting';
import { MingoHomeQuickActions } from './mingo-home-quick-actions';
import { MingoHomeWhatToAsk } from './mingo-home-what-to-ask';

/**
 * Mingo's home (`/mingo`), the Mingo-first shell's landing page: the greeting, then the
 * dashboard as the dashboard shows it (the Initial Setup card, the Devices / Tickets /
 * Customers sections — their cards open the lists filtered), then Mingo's quick actions and
 * "What to ask Mingo?". It holds no composer: the shell docks one under every page, this one
 * included, and a chip here sends through the same chat state.
 */
export function MingoHome() {
  return (
    <div className="flex flex-col">
      <MingoHomeGreeting />
      <InitialSetupSection />
      <OverviewSections filterTicketLinks />
      <PageLayout className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <MingoHomeQuickActions />
        <MingoHomeWhatToAsk />
      </PageLayout>
    </div>
  );
}
