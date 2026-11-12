'use client';

import { useManhattanDock } from '@/app/components/manhattan-shell/manhattan-dock-context';
import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { ManhattanStartWork } from './home/manhattan-start-work';
import { MingoNewChat } from './home/mingo-new-chat';

/**
 * Mingo's home: a new chat, what "New chat" opens; in the Manhattan v2 shell, Start Work.
 * An OSS tenant has no Mingo: there it is the dashboard.
 */
export default function MingoHomePage() {
  const mingo = isSaasTenantMode();
  const manhattan = useManhattanDock();
  useAppModeRedirect(mingo ? null : routes.dashboard);

  if (!mingo) return null;
  return manhattan ? <ManhattanStartWork /> : <MingoNewChat />;
}
