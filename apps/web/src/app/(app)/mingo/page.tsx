'use client';

import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { MingoHome } from './home/mingo-home';

/** Mingo's home: a SaaS tenant's landing page. An OSS tenant has no Mingo: there it is the dashboard. */
export default function MingoHomePage() {
  const mingo = isSaasTenantMode();
  useAppModeRedirect(mingo ? null : routes.dashboard);

  if (!mingo) return null;
  return <MingoHome />;
}
