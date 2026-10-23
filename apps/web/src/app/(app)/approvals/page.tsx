'use client';

import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { ApprovalsView } from './approvals-view';

/** What needs a person's approval. An OSS tenant has no approval requests: there it is Notifications. */
export default function ApprovalsPage() {
  const saas = isSaasTenantMode();
  useAppModeRedirect(saas ? null : routes.notifications());

  if (!saas) return null;
  return <ApprovalsView />;
}
