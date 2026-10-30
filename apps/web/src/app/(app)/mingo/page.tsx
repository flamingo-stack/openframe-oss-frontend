'use client';

import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { MingoNewChat } from './home/mingo-new-chat';

/** Mingo's home: a new chat, what "New chat" opens. An OSS tenant has no Mingo: there it is the dashboard. */
export default function MingoHomePage() {
  const mingo = isSaasTenantMode();
  useAppModeRedirect(mingo ? null : routes.dashboard);

  if (!mingo) return null;
  return <MingoNewChat />;
}
