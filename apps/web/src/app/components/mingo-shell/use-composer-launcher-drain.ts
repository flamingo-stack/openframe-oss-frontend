'use client';

import type { EmbeddableChatHandle } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { type MingoDockRequest, useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import type { DialogIntent } from '@/app/(app)/tickets/constants';
import { routes } from '@/lib/routes';
import { type ComposerRoute, isSheetRoute } from './mingo-dock-route';

/**
 * Publishes the dock to the launcher store while it is mounted: the launchers (Fix
 * with Mingo, Help Center "Ask Mingo") offer themselves only while it is.
 */
export function usePublishComposerDock(): void {
  const setDockMounted = useMingoLauncherStore(s => s.setDockMounted);
  useLayoutEffect(() => {
    setDockMounted(true);
    return () => setDockMounted(false);
  }, [setDockMounted]);
}

interface ComposerLauncherDrainOptions {
  /** The dock chat's handle; null until its lazily loaded module has mounted. Requests wait for it. */
  handle: EmbeddableChatHandle | null;
  route: ComposerRoute;
  /** The follow-wrapped always-new send (`useComposerTarget`). */
  sendInNewDialog: (text: string) => Promise<void>;
  /** The follow-wrapped intent chat (`useComposerTarget`). */
  createIntentDialog: (intent: DialogIntent) => Promise<string | null>;
  /** Selects a chat for the session (`UnifiedChatState.selectDialog`). */
  selectDialog: (dialogId: string) => void;
  /** Raise the chat over the page (`useMingoSheetStore.show`). */
  openSheet: () => void;
  navigate: (href: string) => void;
}

/**
 * Drains the launcher's dock request:
 *  - a draft (Fix with Mingo: the incident's prompt + its `@insight` chip) lands in
 *    the composer under the page it was raised on, as a new chat, and the user's send
 *    opens that chat over the page — as the classic drawer took it beside the page.
 *    From home and the chat page it goes home, as "start a new chat" always does:
 *    home is a new chat, and the chat page re-selects its `?id=` (it would take the new
 *    chat back before it is left, and draw the empty new chat on its way out). The
 *    request waits until the dock is there; the way home does not wait for the chat
 *    module to load;
 *  - a prompt (Meet Mingo, Help Center "Ask Mingo") is sent at once in a new chat,
 *    which then opens over the page, home included (`useComposerTarget`);
 *  - an intent ("Generate with AI" on a create button) creates its chat at once —
 *    Mingo greets in it, nothing is sent — and opens it as a prompt does;
 *  - an existing chat (a notification, "Open Mingo Session", the sidebar's history) opens
 *    over the page, home included; from the chat page, on its own page;
 *  - "What to ask Mingo?" puts the suggestions in the open chat, or a new one, and shows
 *    it: over the page or home (the sheet), in place on the chat page. The suggestions
 *    are local until one is picked, so home cannot send them to a chat page of their own.
 */
export function useComposerLauncherDrain({
  handle,
  route,
  sendInNewDialog,
  createIntentDialog,
  selectDialog,
  openSheet,
  navigate,
}: ComposerLauncherDrainOptions): void {
  const dockRequest = useMingoLauncherStore(s => s.dockRequest);
  const consumeDockRequest = useMingoLauncherStore(s => s.consumeDockRequest);
  // The request already sent home, so re-renders while that navigation is pending do not push again.
  const sentHomeRef = useRef<MingoDockRequest | null>(null);

  useEffect(() => {
    if (!dockRequest) return;
    if (dockRequest.kind === 'open') {
      consumeDockRequest();
      if (route !== 'chat') {
        selectDialog(dockRequest.dialogId);
        openSheet();
      } else {
        navigate(routes.mingo.chat(dockRequest.dialogId));
      }
      return;
    }
    // A prompt and an intent create their chat at once, from wherever they were raised;
    // a draft fills the composer of the page it was raised on; the suggestions show where
    // they were asked for.
    const inPlace =
      dockRequest.kind === 'prompt' ||
      dockRequest.kind === 'intent' ||
      dockRequest.kind === 'whatToAsk' ||
      (dockRequest.kind === 'draft' && isSheetRoute(route));
    if (!inPlace && route !== 'home') {
      if (sentHomeRef.current !== dockRequest) {
        sentHomeRef.current = dockRequest;
        navigate(routes.mingo.home);
      }
      return;
    }
    if (!handle) return;
    const request = consumeDockRequest();
    if (!request) return;
    if (request.kind === 'prompt') void sendInNewDialog(request.prompt);
    else if (request.kind === 'intent') void createIntentDialog(request.intent);
    else if (request.kind === 'draft') handle.prefillDraft(request.draft);
    else if (request.kind === 'newChat') handle.startNewChat();
    else if (request.kind === 'whatToAsk') {
      handle.showWhatToAsk();
      if (route !== 'chat') openSheet();
    }
  }, [
    dockRequest,
    handle,
    consumeDockRequest,
    sendInNewDialog,
    createIntentDialog,
    selectDialog,
    openSheet,
    route,
    navigate,
  ]);
}
