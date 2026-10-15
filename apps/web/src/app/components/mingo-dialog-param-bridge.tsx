'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useShellVariant } from '@/app/hooks/use-shell-variant';
import { MINGO_DIALOG_PARAM, routes, withMingoDialog } from '@/lib/routes';
import { normalizeMingoDialogId } from './notifications/open-mingo-dialog';

/**
 * The Mingo-first shell's reader of `?mingoDialog=<id>` — the classic drawer's URL
 * param, which links written before the chat had a route still carry (copied links,
 * old bundles' notifications, bookmarks), on any route.
 *
 * In the `'mingo'` variant it forwards such a URL to the chat page
 * (`routes.mingo.chat`, the id normalised from a Relay global id to the raw one), which
 * also drops the param. In `'classic'` it does nothing: the drawer's URL sync
 * (`useMingoDialogUrlSync`) is that variant's one owner of the param. In `'loading'` it
 * does nothing either, and the param waits — exactly one owner per variant, and none
 * while the variant is unknown.
 *
 * A dead id is not judged here: the chat page shows its own not-found state.
 */
export function MingoDialogParamBridge() {
  const variant = useShellVariant();
  const router = useRouter();
  // Subscribed so the effect re-runs when the URL changes; the value acted on is
  // re-read from `window.location`, which `useSearchParams()` lags by a transition.
  const urlDialogId = useSearchParams().get(MINGO_DIALOG_PARAM);

  useEffect(() => {
    if (variant !== 'mingo' || urlDialogId === null) return;
    const live = new URLSearchParams(window.location.search).get(MINGO_DIALOG_PARAM);
    if (live === null) return;
    router.replace(
      live
        ? routes.mingo.chat(normalizeMingoDialogId(live))
        : // `?mingoDialog=` with no value names nothing: strip it where it stands.
          withMingoDialog(window.location.pathname + window.location.search + window.location.hash, null),
    );
  }, [variant, urlDialogId, router]);

  return null;
}
