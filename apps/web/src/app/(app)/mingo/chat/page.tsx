'use client';

import { normalizeMingoDialogId } from '@/app/components/notifications/open-mingo-dialog';
import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { MingoChatView } from './mingo-chat-view';

/**
 * One conversation as a page — and the canonical chat link (`mingoDialogLink`). A
 * Relay global id (a link from a bundle older than the raw-id mapping) is swapped for
 * the raw one in the URL. No id: Mingo's home. An OSS tenant has no Mingo: the dashboard.
 */
export default function MingoChatPage() {
  const mingo = isSaasTenantMode();
  const paramId = useRequiredIdParam(routes.mingo.home);
  const dialogId = paramId && normalizeMingoDialogId(paramId);

  let target: string | null = null;
  if (!mingo) target = routes.dashboard;
  else if (dialogId && dialogId !== paramId) target = routes.mingo.chat(dialogId);
  useAppModeRedirect(target);

  if (!dialogId || target) return null;
  return <MingoChatView dialogId={dialogId} />;
}
