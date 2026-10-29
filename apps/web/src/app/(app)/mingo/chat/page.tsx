'use client';

import { useSearchParams } from 'next/navigation';
import { normalizeMingoDialogId } from '@/app/components/notifications/open-mingo-dialog';
import { useAppModeRedirect } from '@/app/hooks/use-app-mode-redirect';
import { isSaasTenantMode } from '@/lib/app-mode';
import { isMingoWhatToAsk, routes } from '@/lib/routes';
import { MingoChatView } from './mingo-chat-view';

/**
 * One conversation as a page — and the canonical chat link (`mingoDialogLink`). A
 * Relay global id (a link from a bundle older than the raw-id mapping) is swapped for
 * the raw one in the URL. "What to ask Mingo?" (`routes.mingo.whatToAsk`) is a new
 * chat here, with no id until a pick creates it. No id otherwise: Mingo's home. An OSS
 * tenant has no Mingo: the dashboard.
 */
export default function MingoChatPage() {
  const mingo = isSaasTenantMode();
  const query = useSearchParams();
  const paramId = query.get('id');
  const whatToAsk = isMingoWhatToAsk(query);
  const dialogId = paramId && normalizeMingoDialogId(paramId);

  let target: string | null = null;
  if (!mingo) target = routes.dashboard;
  else if (!dialogId && !whatToAsk) target = routes.mingo.home;
  else if (dialogId && dialogId !== paramId) target = routes.mingo.chat(dialogId);
  useAppModeRedirect(target);

  if (target) return null;
  return <MingoChatView dialogId={dialogId || null} />;
}
