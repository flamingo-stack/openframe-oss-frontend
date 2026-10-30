'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { isSaasTenantMode } from '@/lib/app-mode';
import { MINGO_DIALOG_PARAM, routes, withMingoDialog } from '@/lib/routes';
import { normalizeMingoDialogId } from './notifications/open-mingo-dialog';

/**
 * The reader of `?mingoDialog=<id>` — the param of the chat drawer the app once had,
 * which links written before the chat had a route still carry (copied links, old
 * bundles' notifications, bookmarks), on any route.
 *
 * Forwards such a URL to the chat page (`routes.mingo.chat`, the id normalised from a
 * Relay global id to the raw one), which also drops the param. Not on an OSS tenant,
 * which has no Mingo. A dead id is not judged here: the chat page shows its own
 * not-found state.
 */
export function MingoDialogParamBridge() {
  const router = useRouter();
  // Subscribed so the effect re-runs when the URL changes; the value acted on is
  // re-read from `window.location`, which `useSearchParams()` lags by a transition.
  const urlDialogId = useSearchParams().get(MINGO_DIALOG_PARAM);

  useEffect(() => {
    if (!isSaasTenantMode() || urlDialogId === null) return;
    const live = new URLSearchParams(window.location.search).get(MINGO_DIALOG_PARAM);
    if (live === null) return;
    router.replace(
      live
        ? routes.mingo.chat(normalizeMingoDialogId(live))
        : // `?mingoDialog=` with no value names nothing: strip it where it stands.
          withMingoDialog(window.location.pathname + window.location.search + window.location.hash, null),
    );
  }, [urlDialogId, router]);

  return null;
}
