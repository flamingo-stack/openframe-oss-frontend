'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useShellRedirect, useShellVariant } from '@/app/hooks/use-shell-variant';
import { routes } from '@/lib/routes';
import { ApprovalsPlaceholder } from './approvals-placeholder';

/**
 * What needs a person's approval, a page of the Mingo-first shell. The classic shell
 * surfaces approval requests as notifications, so there this lands on Notifications.
 */
export default function ApprovalsPage() {
  const variant = useShellVariant();
  useShellRedirect(variant === 'classic' ? routes.notifications() : null);

  if (variant !== 'mingo') return <CompactPageLoader />;
  return <ApprovalsPlaceholder />;
}
