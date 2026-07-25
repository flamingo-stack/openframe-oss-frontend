'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { HelpCenterMenu } from './components/help-center-menu';

// The Help Center index stays a LOCAL page (not extracted to the lib) — it's a
// host-specific landing whose links + icons are app-owned. The grid itself lives
// in `HelpCenterMenu` so the route's loading state can render the same markup.
export default function HelpCenterPage() {
  return (
    <PageLayout title="Help Center" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <HelpCenterMenu />
    </PageLayout>
  );
}
