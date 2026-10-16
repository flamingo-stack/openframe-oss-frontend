'use client';

import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { MingoArchiveView } from './mingo-archive-view';

/** Archived chats. An OSS tenant has no Mingo: there it is the dashboard. */
export default function MingoArchivePage() {
  const mingo = isSaasTenantMode();
  useAppModeRedirect(mingo ? null : routes.dashboard);

  if (!mingo) return null;
  return <MingoArchiveView />;
}
