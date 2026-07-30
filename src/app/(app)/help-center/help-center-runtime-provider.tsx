'use client';

/**
 * HelpCenterRuntimeProvider — a NESTED `ChatRuntime` override for the
 * `/help-center` subtree.
 *
 * The app-wide `OpenframeChatRuntimeProvider` runs in `navigation.mode: 'embed'`
 * and sends every content card OUT to flamingo.run, because the app hosts none
 * of that content in-app. Help Center DOES host two of those surfaces in-app
 * (onboarding-guide + product-release detail routes), so for this subtree only
 * we flip to `mode: 'host'` (in-app soft-nav via the registered Next-router
 * embed-shims) and supply a `composeContentUrl` that:
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
import { notFound } from 'next/navigation';
import { type ReactNode, useContext, useMemo } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { HELP_CENTER_ENDPOINTS } from './endpoints';
import { composeOpenframeContentUrl } from './help-center-content-href';

// NOTE: the lib `PageShell`'s padding is overridden with OpenFrame's host grid
// spacing via the `--page-shell-*` CSS vars set on the section wrapper in
// `layout.tsx` (cascade-scoped to this subtree) — no JS, no per-page prop.

// NOTE: content-fetch auth needs NO wiring here. The lib's content surfaces route
// through `contentFetch`, which reuses the SAME EmbedAuthAdapter the chat registers
// (`openframe-chat-runtime-provider.tsx`) — so `/content/api/*` GET/POSTs carry the
// same bearer + 401-refresh as the chat with zero help-center-specific setup.

export function HelpCenterRuntimeProvider({ children }: { children: ReactNode }) {
  const parent = useContext(ChatRuntimeContext);
  const helpCenter = useFeatureFlagGate('help-center');

  const runtime = useMemo<ChatRuntime>(
    () => ({
      ...(parent as ChatRuntime),
      navigation: { mode: 'host' },
      // `mode: 'host'` → relative `/help-center/...` hrefs soft-nav in-app. The
      // type→route map is shared with the app-wide chat runtime (the single
      // source of truth in `help-center-content-href.ts`) so a card lands in the
      // SAME place whether it's rendered on a Help Center page or in the chat.
      composeContentUrl: composeOpenframeContentUrl,
    }),
    [parent],
  );

  // Help Center is gated behind the `help-center` feature flag. This client
  // boundary wraps every `/help-center/*` route (mounted from the section
  // `layout.tsx`), so guarding here closes the whole subtree in one place —
  // no per-page check. Hooks above run unconditionally; the guard sits before
  // the render to satisfy the rules-of-hooks. (Mirrors the `knowledge-base`
  // page's `notFound()` gate.)
  //
  // Only a definitive "off" 404s. `notFound()` throws, so firing it on a flag that
  // simply hasn't answered yet takes down the whole `/help-center/*` subtree
  // permanently — the boundary renders 404 and nothing re-renders this.
  //
  // "Not answered yet" renders the subtree as normal, with NO placeholder of its own.
  // This gate only ever covered the flag round-trip (never a content fetch), and the
  // landing route under it is a static menu — there is nothing to wait for, so a
  // placeholder there was pure flash: a neutral grey page shape swapped for the real
  // card list a moment later, on every load, for every tenant that has the feature.
  // The content routes deeper in the subtree keep whatever loading state they already
  // had; they just start a beat earlier now.
  //
  // The trade this accepts: a tenant with the flag OFF sees the menu for the length of
  // the flag round-trip before the 404 lands. That surface is generic product help, it
  // is unreachable from the nav (the sidebar omits the row until the flag answers), and
  // the alternative was showing every other tenant a placeholder for nothing.
  if (helpCenter === 'off') {
    notFound();
  }

  // EndpointsRuntime: the authed ticket create form wraps the lib `<ContactForm>`,
  // which calls `useRequiredEndpointsRuntime()` unconditionally — so this provider
  // must wrap the subtree or the form throws once identity resolves to a session.
  // (`HELP_CENTER_ENDPOINTS` is a stable module constant; no memo needed.)
  return (
    <EndpointsRuntimeContext.Provider value={HELP_CENTER_ENDPOINTS}>
      <ChatRuntimeContext.Provider value={runtime}>{children}</ChatRuntimeContext.Provider>
    </EndpointsRuntimeContext.Provider>
  );
}
