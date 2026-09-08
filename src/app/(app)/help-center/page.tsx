'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { BookCallSection } from '../onboarding/components/book-call/book-call-section';
import { HelpCenterMenu } from './components/help-center-menu';

// The Help Center index stays a LOCAL page (not extracted to the lib) — it's a
// host-specific landing whose links + icons are app-owned. The grid itself lives
// in `HelpCenterMenu` so the route's loading state can render the same markup.
//
// `BookCallSection` is the same block the dashboard and /onboarding mount — it
// owns its own scheduling-link request and renders nothing when there is no
// bookable link, so the grid just moves up on hubs that offer none.
export default function HelpCenterPage() {
  return (
    <PageLayout title="Help Center" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <div className="flex flex-col gap-[var(--spacing-system-m)]">
        <BookCallSection />
        <HelpCenterMenu />
      </div>
    </PageLayout>
  );
}
