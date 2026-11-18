'use client';

import { HeadphoneIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { SupportContactModal } from '@/app/components/shared/contact-support-modal';
import { BookCallSection } from '../onboarding/components/book-call/book-call-section';
import { HelpCenterMenu } from './components/help-center-menu';

// The Help Center index stays a LOCAL page (not extracted to the lib) — it's a
// host-specific landing whose links + icons are app-owned. The grid itself lives
// in `HelpCenterMenu` so the route's loading state can render the same markup.
//
// `BookCallSection` is the same block the dashboard and /onboarding mount — it
// owns its own scheduling-link request and renders nothing when there is no
// bookable link, so the grid just moves up on hubs that offer none.
//
// "Contact Support" in the header opens the support ticket / call-back modal
// (design help-center 1:7568, CU-86akejptf). The header's single action stays a
// button on a phone too: `PageActions` only folds two or more into its menu.
export default function HelpCenterPage() {
  const [supportOpen, setSupportOpen] = useState(false);

  const contactSupport: PageActionButton = {
    label: 'Contact Support',
    variant: 'outline',
    icon: <HeadphoneIcon />,
    onClick: () => setSupportOpen(true),
  };

  return (
    <PageLayout
      title="Help Center"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      actions={[contactSupport]}
    >
      <div className="flex flex-col gap-[var(--spacing-system-m)]">
        <BookCallSection />
        <HelpCenterMenu />
      </div>
      <SupportContactModal open={supportOpen} onOpenChange={setSupportOpen} />
    </PageLayout>
  );
}
