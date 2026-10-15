'use client';

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useRef } from 'react';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';

/**
 * Which chat the docked composer writes into, and where the user goes when a send
 * starts a new one (PLAN §3.7).
 *
 * - **Home is a new chat.** Entering `/mingo` deselects the open chat — once per
 *   visit, not on every render, so the chat a send from home creates is not
 *   dropped the moment it opens. A draft typed for another chat goes with it: the
 *   composer belongs to the conversation on screen (the lib drops it on every
 *   dialog change).
 * - **Every other page continues the selected chat.** Nothing to do: the
 *   selection is the session's and outlives navigation.
 * - **A send that creates a chat follows it to its page**, `routes.mingo.chat(id)`,
 *   as soon as the id is known, so the reply is on screen. That is any dock send
 *   with no chat open, the dock's quick actions and launcher prompts
 *   (`sendInNewDialog`), and, on home, ANY chat that becomes active — home is
 *   always a new chat, so one appearing there was just created, by the dock or by
 *   the home page's own quick actions. A send into the open chat stays where it is,
 *   on the chat page and everywhere else.
 */
interface ComposerTargetOptions {
  route: ComposerRoute;
  state: UnifiedChatState;
  /** The session's always-new send (`MingoChatState.sendInNewDialog`). */
  sendInNewDialog: (text: string) => Promise<void>;
  navigate: (href: string) => void;
}

interface ComposerTarget {
  /** `state` whose send, when no chat is open, follows the chat it creates. Hand it to `EmbeddableChat`. */
  mingoState: UnifiedChatState;
  /** `sendInNewDialog` that follows the chat it creates. */
  sendInNewDialog: (text: string) => Promise<void>;
}

/** A send that will create a chat; `from` is the chat open when it started. */
interface PendingFollow {
  from: string | null;
}

export function useComposerTarget({ route, state, sendInNewDialog, navigate }: ComposerTargetOptions): ComposerTarget {
  const activeDialogId = state.activeDialogId ?? null;
  const { selectDialog } = state;

  // Home: a new chat, once per visit.
  const homeVisitRef = useRef(false);
  useEffect(() => {
    if (route !== 'home') {
      homeVisitRef.current = false;
      return;
    }
    if (homeVisitRef.current) return;
    homeVisitRef.current = true;
    if (activeDialogId !== null) selectDialog(null);
  }, [route, activeDialogId, selectDialog]);

  // The last active chat this hook has seen committed, and the send waiting for its chat.
  const committedIdRef = useRef(activeDialogId);
  const followRef = useRef<PendingFollow | null>(null);
  useEffect(() => {
    const previous = committedIdRef.current;
    committedIdRef.current = activeDialogId;
    if (activeDialogId === null || activeDialogId === previous) return;
    const follow = followRef.current;
    const created = follow !== null && follow.from !== activeDialogId;
    if (created) followRef.current = null;
    if (created || route === 'home') navigate(routes.mingo.chat(activeDialogId));
  }, [activeDialogId, route, navigate]);

  // Wraps a send that may create a chat. A send that ends with no new chat (the
  // create failed) disarms, so a later selection is not taken for its chat. One
  // that created it was already followed by the effect above: the id commits before
  // the send itself returns.
  const following = async <T>(send: () => Promise<T>): Promise<T> => {
    const follow: PendingFollow = { from: committedIdRef.current };
    followRef.current = follow;
    try {
      return await send();
    } finally {
      if (followRef.current === follow && committedIdRef.current === follow.from) followRef.current = null;
    }
  };

  const mingoState: UnifiedChatState = {
    ...state,
    sendMessage: (text, options) =>
      state.activeDialogId ? state.sendMessage(text, options) : following(() => state.sendMessage(text, options)),
  };

  return {
    mingoState,
    sendInNewDialog: text => following(() => sendInNewDialog(text)),
  };
}
