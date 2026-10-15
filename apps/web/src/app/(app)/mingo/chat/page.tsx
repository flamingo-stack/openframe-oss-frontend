'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { normalizeMingoDialogId } from '@/app/components/notifications/open-mingo-dialog';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { useShellRedirect, useShellVariant } from '@/app/hooks/use-shell-variant';
import { routes, withMingoDialog } from '@/lib/routes';
import { MingoChatPlaceholder } from './mingo-chat-placeholder';

/**
 * One conversation as a page — and the canonical chat link (`mingoDialogLink`), so it
 * resolves in both shells. In the classic shell it becomes the drawer's resting URL on
 * the dashboard, which the drawer's URL sync adopts. A Relay global id (a link from a
 * bundle older than the raw-id mapping) is swapped for the raw one in the URL. No id:
 * Mingo's home.
 */
export default function MingoChatPage() {
  const variant = useShellVariant();
  const paramId = useRequiredIdParam(routes.mingo.home);
  const dialogId = paramId && normalizeMingoDialogId(paramId);

  let target: string | null = null;
  if (dialogId && variant === 'classic') target = withMingoDialog(routes.dashboard, dialogId);
  else if (dialogId && variant === 'mingo' && dialogId !== paramId) target = routes.mingo.chat(dialogId);
  useShellRedirect(target);

  if (variant !== 'mingo' || !dialogId || target) return <CompactPageLoader />;
  return <MingoChatPlaceholder dialogId={dialogId} />;
}
