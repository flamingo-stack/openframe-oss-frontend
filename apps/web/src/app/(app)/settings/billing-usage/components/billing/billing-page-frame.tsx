'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuGroup,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { openBillingInBrowser } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';

/**
 * The read-only (desktop) build's one header action: billing is changed in the browser. Stated before the
 * subscription answers, so the page's header holds it loading and loaded alike.
 */
export const READ_ONLY_BILLING_ACTIONS: PageActionButton[] = [
  {
    label: 'Manage Billing',
    icon: <ExternalLinkIcon className="h-6 w-6" />,
    onClick: openBillingInBrowser,
    variant: 'accent',
  },
];

interface BillingPageFrameProps {
  actions?: PageActionButton[];
  menuActions?: ActionsMenuGroup[];
  /** The header's actions are the subscription's and it has not answered: they are drawn as placeholders. */
  loadingActions?: boolean;
  children: ReactNode;
}

/**
 * The billing page's frame: its title, its back link and its header actions. Static, so the page
 * (`BillingUsageScreen`) and the wait for its code (`billing-usage-view.tsx`'s dynamic fallback) draw one frame, never two copies.
 */
export function BillingPageFrame({ actions, menuActions, loadingActions = false, children }: BillingPageFrameProps) {
  const handleBack = useSafeBack(routes.settings.root());
  return (
    <PageLayout
      title="Billing & Usage"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back to Settings', onClick: handleBack }}
      actionsVariant="menu-primary"
      actions={actions}
      menuActions={menuActions}
      loadingActions={loadingActions}
    >
      {children}
    </PageLayout>
  );
}
