'use client';

import type { EmbeddableChatHandle } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { type MingoDockRequest, useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import type { DialogIntent } from '@/app/(app)/tickets/constants';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';

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
  navigate: (href: string) => void;
}

/**
 * Drains the launcher's dock request:
 *  - a draft (Fix with Mingo: the incident's prompt + its `@insight` chip) and
 *    "start a new chat" land on home — a new chat — with the composer prefilled or
 *    empty; the user's send then follows the new chat to its page. The request
 *    waits until the dock is on home, so the page it was raised from (a chat page
 *    re-selecting its `?id=`) cannot take the new chat back before it is left — and
 *    the chat page never draws the empty new chat on its way out. The way home does
 *    not wait for the chat module to load;
 *  - a prompt (Meet Mingo, Help Center "Ask Mingo") is sent at once in a new chat,
 *    and that send follows the chat to its page. Not through home: the end state is
 *    the same, and a hop there would only flash home and put it in Back's way;
 *  - an intent ("Generate with AI" on a create button) creates its chat at once —
 *    Mingo greets in it, nothing is sent — and follows it to its page, as a prompt.
 */
export function useComposerLauncherDrain({
  handle,
  route,
  sendInNewDialog,
  createIntentDialog,
  navigate,
}: ComposerLauncherDrainOptions): void {
  const dockRequest = useMingoLauncherStore(s => s.dockRequest);
  const consumeDockRequest = useMingoLauncherStore(s => s.consumeDockRequest);
  // The request already sent home, so re-renders while that navigation is pending do not push again.
  const sentHomeRef = useRef<MingoDockRequest | null>(null);

  useEffect(() => {
    if (!dockRequest) return;
    // A prompt and an intent create their chat at once, from wherever they were raised.
    const atOnce = dockRequest.kind === 'prompt' || dockRequest.kind === 'intent';
    if (!atOnce && route !== 'home') {
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
    else handle.startNewChat();
  }, [dockRequest, handle, consumeDockRequest, sendInNewDialog, createIntentDialog, route, navigate]);
}
