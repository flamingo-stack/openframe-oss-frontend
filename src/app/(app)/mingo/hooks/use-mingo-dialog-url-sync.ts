'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { openMingoDialogInDrawer } from '@/app/components/notifications/open-mingo-dialog';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { MINGO_DIALOG_PARAM, withMingoDialog } from '@/lib/routes';
import { useMingoLauncherStore } from '../stores/mingo-launcher-store';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';

/** What one pass of the sync decides to do. Exactly one thing happens per pass. */
export type MingoUrlSyncAction =
  | { type: 'none' }
  | { type: 'close' }
  | { type: 'adopt'; dialogId: string }
  /** `null` strips the param. */
  | { type: 'write'; dialogId: string | null };

export interface MingoUrlSyncInput {
  navigated: boolean;
  /** `?mingoDialog=` on the current URL. */
  urlDialogId: string | null;
  /** The id this sync last put in the URL — how a param WE wrote is told apart
   *  from one the URL brought us, and a param we removed from one that vanished. */
  mirroredDialogId: string | null;
  mingoGate: FeatureFlagGate;
  /** A drawer is actually mounted to receive a dialog (flag on, not lock-screened). */
  canOpenDrawer: boolean;
  drawerOpen: boolean;
  activeDialogId: string | null;
  /** The drawer closed BECAUSE of a navigation issued in the same handler. */
  closedForNavigation: boolean;
}

/**
 * The whole URL⇄drawer decision, as a pure function.
 *
 * It is pure because the ordering IS the design. URL→store and store→URL are two
 * directions over one value, and split across separate effects every commit has a
 * tie to break by hook-declaration order — which is how the first draft of this
 * came to strip the very param it was meant to adopt (both halves running in one
 * flush off the same pre-adopt render). One ordered body, one outcome per pass,
 * and the order is a thing tests can assert instead of a thing reviewers must
 * reconstruct.
 */
export function resolveMingoUrlSync({
  navigated,
  urlDialogId,
  mirroredDialogId,
  mingoGate,
  canOpenDrawer,
  drawerOpen,
  activeDialogId,
  closedForNavigation,
}: MingoUrlSyncInput): MingoUrlSyncAction {
  // 1. No instruction in the URL, and either it just lost the one we were
  //    mirroring (back/forward) or the route changed under an open drawer. The
  //    URL wins.
  //
  //    The `navigated` arm is the app's existing close-on-navigate: the drawer is
  //    non-modal, so following a nav link or an in-chat link should land on the
  //    new page rather than leave a panel covering it. It lives here, and not in
  //    its own effect in `AppShell`, because a navigation can CARRY an instruction
  //    — the `/mingo` deep-link hop redirects to `?mingoDialog=` — and a close in
  //    a separate effect would race that open within the same commit.
  if (!urlDialogId && (navigated || mirroredDialogId)) {
    return { type: 'close' };
  }

  // 2. An instruction we have not consumed yet.
  if (urlDialogId && urlDialogId !== mirroredDialogId) {
    // Hold it — WITHOUT marking it consumed — until there is a drawer to honour
    // it in. A push tap beats the feature-flags query on cold start, and a plain
    // flag read says "off" for that whole window, so treating `loading` as `off`
    // here would drop exactly the deep links this exists to serve.
    if (mingoGate === 'loading') return { type: 'none' };
    if (mingoGate === 'on') {
      return canOpenDrawer ? { type: 'adopt', dialogId: urlDialogId } : { type: 'none' };
    }
    // Flag definitively off: nothing will ever render this dialog for this
    // tenant, so fall through and let the projection strip the dead param.
  }

  // 3. Project state onto the URL. A drawer open on nothing stays out of it —
  //    there is no conversation to share, and keeping it out leaves the param
  //    exactly one meaning.
  //
  //    `canOpenDrawer` gates this too, not just the adopt: the launcher store's
  //    `isOpen` survives the drawer unmounting, so a subscription lock engaging
  //    mid-conversation would otherwise leave the URL advertising an open chat
  //    on the lock screen until the next navigation healed it.
  const desired = canOpenDrawer && drawerOpen ? activeDialogId : null;
  if (desired === urlDialogId) return { type: 'none' };

  // A drawer closed BY a navigation does not own the URL: the destination is
  // already param-free, and this pass still sees the pre-navigation location
  // (React flushes the close before the push's transition commits), so writing
  // would stamp the old URL over the navigation in flight. Step 1 clears the
  // mirror once the URL lands.
  if (desired === null && closedForNavigation) return { type: 'none' };

  return { type: 'write', dialogId: desired };
}

/**
 * Makes the Mingo chat drawer addressable by URL: `?mingoDialog=<id>` on whatever
 * route is showing names the open conversation, so it survives a reload, can be
 * copied out of the address bar, and is what a deep link resolves INTO.
 *
 * The drawer has no route of its own and cannot get one. The Next-canonical answer
 * — parallel + intercepting routes — is a hard `ExportError` under `output: 'export'`,
 * which this app builds for the native shells; and a plain route would swap the
 * `children` slot, unmounting the page the drawer is supposed to float over.
 *
 * Mounted once in `AppShell` rather than inside the drawer, which unmounts on close
 * and so cannot be what reads an incoming link.
 *
 * ## No history entries
 *
 * `replaceState` only, never `pushState`: switching conversations is high-frequency,
 * and the native shells already dismiss the drawer on Android back
 * (`useNativeBackDismissible`) without touching history, so pushed entries would
 * have back handled twice. A traversal that lands on a URL WITHOUT the param is
 * honoured as authoritative and closes the drawer — the alternative is re-stamping
 * the param onto the entry the user just went back to, rewriting history underneath
 * them and making Back look dead.
 */
export function useMingoDialogUrlSync(canOpenDrawer: boolean): void {
  const pathname = usePathname();
  // Subscribed purely so the effect re-runs when the URL changes; the value it acts
  // on is re-read from `window.location` (see the effect).
  const urlDialogId = useSearchParams().get(MINGO_DIALOG_PARAM);
  const mingoGate = useFeatureFlagGate('mingo-sidebar');

  const isOpen = useMingoLauncherStore(state => state.isOpen);
  const activeDialogId = useMingoMessagesStore(state => state.activeDialogId);

  const mirroredRef = useRef<string | null>(null);
  const prevPathnameRef = useRef(pathname);

  // Every value the resolver compares is read FRESH in the body; the deps exist only
  // to re-run it. That matters most for the URL: `mirroredRef` is written
  // synchronously, but Next dispatches its `ACTION_RESTORE` inside `startTransition`,
  // so `useSearchParams()` lags a `replaceState` by at least one commit. A
  // default-lane store update landing in that window — React flushes it BEFORE the
  // pending transition — would compare a fresh `mirroredRef` against a stale
  // `urlDialogId` and pick `close`, or adopt the conversation the user just left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-run triggers; the body re-reads each one so it is never a commit stale
  useEffect(() => {
    const navigated = prevPathnameRef.current !== pathname;
    prevPathnameRef.current = pathname;

    const action = resolveMingoUrlSync({
      navigated,
      urlDialogId: new URLSearchParams(window.location.search).get(MINGO_DIALOG_PARAM),
      mirroredDialogId: mirroredRef.current,
      mingoGate,
      canOpenDrawer,
      drawerOpen: useMingoLauncherStore.getState().isOpen,
      activeDialogId: useMingoMessagesStore.getState().activeDialogId,
      closedForNavigation: useMingoLauncherStore.getState().closedForNavigation,
    });

    switch (action.type) {
      case 'close':
        mirroredRef.current = null;
        useMingoLauncherStore.getState().close();
        return;
      case 'adopt':
        mirroredRef.current = action.dialogId;
        openMingoDialogInDrawer(action.dialogId);
        return;
      case 'write': {
        mirroredRef.current = action.dialogId;
        const live = window.location.pathname + window.location.search + window.location.hash;
        // `null` state, NOT `history.state`: Next's patched `replaceState` early-returns
        // on any state carrying `__NA`/`_N` — which every entry it owns does — and skips
        // its router sync, so the address bar would change while `useSearchParams()` went
        // permanently stale. `null` still preserves Next's internals;
        // `copyNextJsInternalHistoryState` re-copies them off the current entry.
        window.history.replaceState(null, '', withMingoDialog(live, action.dialogId));
        return;
      }
      case 'none':
        return;
    }
  }, [pathname, urlDialogId, isOpen, activeDialogId, mingoGate, canOpenDrawer]);
}
