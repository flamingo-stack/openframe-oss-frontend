'use client';

/**
 * HelpCenterRuntimeProvider — a NESTED `ChatRuntime` override for the
 * `/help-center` subtree.
 *
 * The app-wide `OpenframeChatRuntimeProvider` is already `mode: 'host'`, so this
 * override now carries only the content-href seam; the mode is restated for the
 * subtree's own sake. Help Center hosts two content surfaces in-app
 * (onboarding-guide + product-release detail routes), so it supplies a
 * `composeContentUrl` that:
 *   - returns relative `/help-center/...` hrefs for the types we host, and
 *   - deep-links roadmap/delivery items into their list route (`?search=<id>`),
 *   - falls back to the flamingo content hub for everything else.
 *
 * It spreads the parent runtime so chat-side config (endpoints / auth source /
 * imageProxy) is preserved — only navigation + the content-href seam change.
 */

import {
  type ChatRuntime,
  ChatRuntimeContext,
  EndpointsRuntimeContext,
} from '@flamingo-stack/openframe-frontend-core/contexts';
import { type ReactNode, useContext, useMemo } from 'react';
import { CONTENT_ENDPOINTS } from './endpoints';
import { composeOpenframeInAppContentUrl } from './help-center-content-href';

// NOTE: the lib `PageShell`'s padding is overridden with OpenFrame's host grid
// spacing via the `--page-shell-*` CSS vars set on the section wrapper in
// `layout.tsx` (cascade-scoped to this subtree) — no JS, no per-page prop.

// NOTE: content-fetch auth needs NO wiring here. The lib's content surfaces route
// through `contentFetch`, which reuses the SAME EmbedAuthAdapter the chat registers
// (`openframe-chat-runtime-provider.tsx`) — so `/content/api/*` GET/POSTs carry the
// same bearer + 401-refresh as the chat with zero help-center-specific setup.

export function HelpCenterRuntimeProvider({ children }: { children: ReactNode }) {
  const parent = useContext(ChatRuntimeContext);

  const runtime = useMemo<ChatRuntime>(
    () => ({
      ...(parent as ChatRuntime),
      // SPREAD, not replaced: `navigation` is four optional callbacks, so a bare
      // `{ mode: 'host' }` type-checks while silently dropping the parent's
      // `navigate` / `decideNewTab` / `openExternal` — which is how this subtree
      // lost the app-shell's external opener and the `targetPlatform: null` forcing.
      navigation: { ...(parent as ChatRuntime).navigation, mode: 'host' },
      // `mode: 'host'` → relative `/help-center/...` hrefs soft-nav in-app. The
      // type→route map is shared with the app-wide chat runtime (the single
      // source of truth in `help-center-content-href.ts`) so a card lands in the
      // SAME place whether it's rendered on a Help Center page or in the chat.
      //
      // This seam ALSO drives the RAG search dropdown mounted by the onboarding
      // catalog + knowledge base (the lib threads `composeContentUrl` into
      // `useDocSearch`), so picking a guide there soft-navs to
      // `/help-center/onboarding-guides/<slug>` instead of the hub URL the RAG
      // returns. Hub-only rows keep their absolute hub href → new tab.
      composeContentUrl: composeOpenframeInAppContentUrl,
    }),
    [parent],
  );

  // EndpointsRuntime: the authed ticket create form wraps the lib `<ContactForm>`,
  // which calls `useRequiredEndpointsRuntime()` unconditionally — so this provider
  // must wrap the subtree or the form throws once identity resolves to a session.
  // (`CONTENT_ENDPOINTS` is a stable module constant; no memo needed.)
  return (
    <EndpointsRuntimeContext.Provider value={CONTENT_ENDPOINTS}>
      <ChatRuntimeContext.Provider value={runtime}>{children}</ChatRuntimeContext.Provider>
    </EndpointsRuntimeContext.Provider>
  );
}
