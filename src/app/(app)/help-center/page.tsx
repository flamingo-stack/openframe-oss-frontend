'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { BookCallSection } from '../onboarding/components/book-call/book-call-section';
import { HelpCenterMenu } from './components/help-center-menu';

// The Help Center index stays a LOCAL page (not extracted to the lib) — it's a
// host-specific landing whose links + icons are app-owned. The grid itself lives
// in `HelpCenterMenu` so the route's loading state can render the same markup.
//
// `BookCallSection` is the SAME block the dashboard Initial Setup card and the
// /onboarding tour mount — reused, not re-cut: it owns the scheduling-link
// request, the swap into the scheduler, and the claim on the walkthrough video.
// It renders nothing once that request settles with no bookable link, so the
// grid simply moves up on hubs that offer none.
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
