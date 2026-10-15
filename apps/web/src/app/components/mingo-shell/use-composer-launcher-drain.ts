'use client';

import type { EmbeddableChatHandle } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { type MingoDockRequest, useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';

/**
 * Publishes the dock to the launcher store while it is mounted, so the launchers
 * (Fix with Mingo, Meet Mingo, Help Center "Ask Mingo", Start New Chat) queue a
 * request for it instead of opening a drawer this shell does not have. A layout
 * effect: it lands before the chat state starts, so a request queued for the
 * classic drawer just before the dock mounted is adopted, not left to the classic
 * prompt drain.
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
  navigate: (href: string) => void;
}

/**
 * Drains the launcher's dock request:
 *  - a draft (Fix with Mingo: the incident's prompt + its `@insight` chip) and
 *    "start a new chat" land on home — a new chat — with the composer prefilled or
 *    empty; the user's send then follows the new chat to its page. The request
 *    waits until the dock is on home, so the page it was raised from (a chat page
 *    re-selecting its `?id=`) cannot take the new chat back before it is left;
 *  - a prompt (Meet Mingo, Help Center "Ask Mingo") is sent at once in a new chat,
 *    and that send follows the chat to its page. Not through home: the end state is
 *    the same, and a hop there would only flash home and put it in Back's way.
 */
export function useComposerLauncherDrain({
  handle,
  route,
  sendInNewDialog,
  navigate,
}: ComposerLauncherDrainOptions): void {
  const dockRequest = useMingoLauncherStore(s => s.dockRequest);
  const consumeDockRequest = useMingoLauncherStore(s => s.consumeDockRequest);
  // The request already sent home, so re-renders while that navigation is pending do not push again.
  const sentHomeRef = useRef<MingoDockRequest | null>(null);

  useEffect(() => {
    if (!dockRequest || !handle) return;
    if (dockRequest.kind !== 'prompt' && route !== 'home') {
      if (sentHomeRef.current !== dockRequest) {
        sentHomeRef.current = dockRequest;
        navigate(routes.mingo.home);
      }
      return;
    }
    const request = consumeDockRequest();
    if (!request) return;
    if (request.kind === 'prompt') void sendInNewDialog(request.prompt);
    else if (request.kind === 'draft') handle.prefillDraft(request.draft);
    else handle.startNewChat();
  }, [dockRequest, handle, consumeDockRequest, sendInNewDialog, route, navigate]);
}
