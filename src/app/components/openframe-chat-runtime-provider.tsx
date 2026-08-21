'use client';

/**
 * OpenframeChatRuntimeProvider — supplies the `ChatRuntime` context the
 * lib's `<EmbeddableChat>` requires. Openframe-frontend exposes BOTH
 * Mingo (NATS, openframe backend) and Guide (SSE, MPH backend via the
 * `/content` proxy) modes through the in-panel toggle. The endpoint URLs
 * below cover both transports:
 *
 *   - Mingo callbacks live in `MingoEmbeddableChatEntry` and don't touch
 *     this runtime — they call `apiClient` against `/chat/*` directly.
 *   - Guide reads its endpoint URLs FROM this runtime. Each Guide path
 *     is prefixed with `/content/`; the openframe-frontend Next.js layer
 *     reverse-proxies that prefix to the MPH origin so neither the lib
 *     nor the host page learns the upstream MPH URL.
 *
 * Navigation is `mode: 'host'` — IDENTICAL to MPH's `HubRuntimeProvider`
 * (hub.openframe.ai). openframe-frontend hosts its own copy of the content the
 * chat cites (the `openframe-docs` knowledge base at `/help-center/knowledge-base`,
 * plus tickets / FAQ / releases / roadmap under `/help-center`), so it behaves as
 * the content HOST, not a cross-origin embedder. In host mode the lib leaves
 * relative hrefs untouched (they resolve against OUR origin) and defers the
 * new-tab decision to `navigation.decideNewTab`. Concretely, mirroring the hub:
 *   - `navigate`   — in-page doc-tree swap (`useDocNavigation`) → same-origin
 *                    `router.push` (with same-page-hash smoothing) → false for
 *                    cross-origin (lib opens externally).
 *   - `decideNewTab` — lib's `decideNewTab` with our `source`: same-platform /
 *                    same-origin → same tab; cross-platform / cross-origin → new tab.
 * Result: `openframe-docs` chips / cards / search results soft-nav in-app on OUR
 * origin (just like they stay on hub.openframe.ai on the hub); genuinely external
 * content (blog / podcasts / …), emitted by `composeContentUrl` as absolute hub
 * URLs, still opens in a new tab on the hub.
 */

import {
  isCrossOriginUrl,
  decideNewTab as libDecideNewTab,
  stripSameOriginToPath,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useDocNavigation } from '@flamingo-stack/openframe-frontend-core/components/docs';
import { type ChatRuntime, ChatRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import {
  buildListUrl as buildEntityCardListUrl,
  clearEmbedProxyAuth,
  type EmbedAuthAdapter,
  navigateSamePageHash,
  setEmbedAuthAdapter,
} from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useMemo } from 'react';
import { CONTENT_ORIGIN } from '@/app/(app)/help-center/endpoints';
import { composeOpenframeInAppContentUrl } from '@/app/(app)/help-center/help-center-content-href';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { getAccessTokenSync, getTokenEpoch, isBearerAuthMode } from '@/lib/token-store';

/**
 * Content-href seam for openframe. The type→route map is shared with the Help
 * Center pages (single source of truth in `help-center-content-href.ts`): every
 * type openframe hosts in-app — the slugged ones (product release / onboarding
 * guide) and the ones routed by explicit override (roadmap / delivery / HubSpot
 * tickets / FAQ) — resolves to a `/help-center/...` same-origin URL, so
 * host-mode nav recognizes them as in-app and soft-navs there instead of
 * bouncing the card out to the hub. Every other type (blog / podcast /
 * case-study / …) still opens OUT to its RAG-authoritative `externalUrl` on
 * the content hub.
 */

import { refreshAccessToken } from '@/lib/token-refresh-manager';

/** Stable source identifier used for localStorage namespacing inside the
 *  lib (`mingo-chat-openframe-v1` keys). Must not change between
 *  deployments or users lose their local Guide history. Openframe is
 *  Mingo-only today, so the source value is more of a namespace label
 *  than a content discriminator. */
const CHAT_SOURCE = 'openframe' as const;

/**
 * Token epoch observed the last time this adapter attached credentials to an
 * outgoing chat request. Read back in `refresh()` so a 401 raised under a
 * credential that has ALREADY been replaced retries instead of rotating again.
 *
 * The adapter is a module singleton and core calls `getHeaders()` from more
 * than the send path (`needsBearerAssetFetch` probes authed images with it), so
 * this is really the last HEADER BUILD rather than the send that produced the
 * 401 — the correlation is deliberately loose. It is
 * still safe: the stored value can only lag the current epoch, and lagging
 * means a rotation happened after that send, which is exactly when a retry is
 * the right answer. The failure mode is a missed short-circuit (one extra
 * refresh, today's behavior), never a retry with a genuinely dead token.
 */
let lastChatSendEpoch = 0;

/**
 * Auth adapter the lib's `embedAuthedFetch` consults on every embedded-chat
 * request. Defined at module scope (not rebuilt per render) so it can be
 * registered SYNCHRONOUSLY on first render — before the child chat effects
 * (identity / slash-commands fire in their own mount effects, which run
 * BEFORE a parent `useEffect`). All deps it closes over are module-level.
 */
const CHAT_AUTH_ADAPTER: EmbedAuthAdapter = {
  getHeaders: () => {
    // Recorded for BOTH auth modes: cookie-mode rotations advance the epoch too
    // (`markTokenRotation` in the refresh manager), and the chat rides cookies
    // there via `credentials: 'include'`.
    lastChatSendEpoch = getTokenEpoch();
    // Mirror `apiClient.getAuthHeaders()` EXACTLY: only attach a stored Bearer
    // in bearer mode (dev-ticket web or native shell). In normal cookie mode
    // the access token lives in an http-only cookie that `oauth/refresh`
    // rotates server-side; the client-side copy is only maintained in bearer
    // mode (token-refresh-manager gates its writes the same way). Sending a
    // copy outside bearer mode would ship a stale/expired Bearer that the
    // gateway prefers over the fresh cookie. Omit it and let
    // `credentials: 'include'` carry the cookie.
    if (!isBearerAuthMode()) return {};
    const token = getAccessTokenSync();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  // Send openframe cookies cross-origin to the gateway; CORS +
  // `SameSite=None` on cookies must be configured server-side. (Harmless
  // no-op in production, where the frontend and gateway share one origin.)
  credentials: 'include',
  // `refreshAccessToken` already dedups concurrent refreshes internally, and
  // `embedAuthedFetch` dedups 401-triggered retries on top — so a stampede of
  // simultaneously-expiring chat requests refreshes once. Passing the send-time
  // epoch closes the remaining gap: a 401 that lands AFTER that refresh
  // finished is stale news and resolves to a retry rather than a second
  // rotation (which, with rotating refresh tokens, invalidates the credential
  // just obtained).
  refresh: () => refreshAccessToken(lastChatSendEpoch),
  // Native shell only: the page origin (`capacitor://localhost`) has no server
  // behind it, so every `/content` call goes ABSOLUTE to the tenant gateway
  // (see `help-center/endpoints.ts`) — sanction exactly that origin for
  // `embedAuthedFetch`'s cross-origin guard. Empty on the web, where the
  // same-origin rule stays absolute.
  allowedOrigins: CONTENT_ORIGIN ? [CONTENT_ORIGIN] : [],
};

// Register the auth adapter + drop legacy proxy-auth ONCE, at module load —
// i.e. before the provider renders or any child chat effect fires a request.
// Why not in render / useEffect: the chat's identity & slash-command requests
// fire from CHILD mount effects, which run before a parent `useEffect`; and a
// `useState` initializer races StrictMode's double-invoke + the unmount-null,
// leaving the first requests adapter-less (the `credentials: 'same-origin'` +
// 401 + no-refresh symptom). The adapter is a stateless module singleton
// (reads localStorage/env fresh per call), so a single app-lifetime
// registration with no teardown is correct — and runs exactly once, so there
// is no "overwriting a previously-registered adapter" warning.
//
// `clearEmbedProxyAuth()`: openframe never does proxy-impersonation, but an
// earlier `setEmbedProxyAuth`-based approach persisted the openframe JWT under
// `<appType>.chat.proxy-auth.v1`. That copy is frozen at login, so
// `applyProxyAuth` kept attaching a stale/expired Bearer to `/content/*`.
if (typeof window !== 'undefined') {
  clearEmbedProxyAuth();
  setEmbedAuthAdapter(CHAT_AUTH_ADAPTER);
}

export function OpenframeChatRuntimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // In-app doc-tree swap bridge — the same hook the hub wires into `navigate`.
  // When a knowledge-base viewer is mounted it swaps the doc in place; otherwise
  // its safe no-op fallback returns false and we `router.push` instead.
  const docNav = useDocNavigation();

  // Host-mode navigation callbacks — mirror MPH's `HubRuntimeProvider` so the
  // `openframe-docs` chips / cards / search results navigate identically here.
  const navigate = useCallback<NonNullable<ChatRuntime['navigation']['navigate']>>(
    ({ href, path }) => {
      // Every branch that moves THIS window also dismisses the Mingo drawer the
      // chat may be sitting in. `AppShell` closes it on a `pathname` change, but
      // that misses exactly the links a chat emits most: a doc swap and a hash
      // jump change no path at all, and `?id=`/`?slug=` targets change only the
      // query — so the drawer stayed over the page it had just navigated, which
      // below md is the entire viewport. A no-op when the drawer is closed, i.e.
      // for the Help Center / knowledge-base surfaces sharing this runtime.
      const navigated = () => {
        useMingoLauncherStore.getState().close();
        return true;
      };

      // 1. In-page doc-tree swap when `path` matches a mounted viewer.
      if (path != null && docNav.navigate(path)) return navigated();
      // 2. Same-origin URL → soft-nav (hash targets get the smooth same-page tween
      //    + synthetic `hashchange` so FAQ auto-expand / scroll-to-hash still fire).
      if (!isCrossOriginUrl(href)) {
        const target = stripSameOriginToPath(href);
        if (!navigateSamePageHash(target)) router.push(target);
        return navigated();
      }
      // 3. Cross-origin → let the lib open it (new tab).
      return false;
    },
    [router, docNav],
  );

  // New-tab decision is purely ORIGIN-based, and deliberately drops the incoming
  // `targetPlatform`. Our `composeContentUrl` emits in-app content as RELATIVE
  // hrefs (`isCrossOriginUrl` → false → same tab, soft-nav on our origin) and
  // hub content as ABSOLUTE URLs (→ true → new tab). We must NOT feed
  // `targetPlatform` into the lib rule: the RAG tags every openframe row
  // `targetPlatform: 'openframe'` (== our `source`), which the lib's platform
  // branch reads as "same app → same tab" — even for hub content we don't host
  // (webinar / blog / …). That flipped a hub webinar URL to same-tab, so the click
  // handler stripped its origin and `router.push`ed `/webinars/<id>` → 404 on our
  // origin. Passing `targetPlatform: null` forces the lib onto its origin-compare
  // fallback, which is exactly right once in-app=relative / hub=absolute holds.
  const decideNewTab = useCallback<NonNullable<ChatRuntime['navigation']['decideNewTab']>>(
    ({ href }) => libDecideNewTab({ href, targetPlatform: null, currentSource: CHAT_SOURCE }),
    [],
  );

  // How a link the rule above sent to a "new tab" actually opens. The lib's
  // default is `window.open(href, '_blank')`, which the app shell's WebView drops
  // on the floor — the link is a dead click there. Same window instead wherever
  // that is the case (`useSameWindowLinks`); in the shell an off-origin
  // `location.assign` is handed to the system browser, so external content still
  // leaves the app rather than replacing it.
  //
  // Only ever fed CROSS-ORIGIN hrefs: `decideNewTab` above is origin-based, so
  // everything on our origin already resolves to `navigate` (a `router.push`).
  // Synchronous, as the runtime requires — a deferred `window.open` is a blocked
  // popup on Safari.
  const sameWindow = useSameWindowLinks();
  const openExternal = useCallback<NonNullable<ChatRuntime['navigation']['openExternal']>>(
    href => {
      if (sameWindow) window.location.assign(href);
      else window.open(href, '_blank', 'noopener,noreferrer');
    },
    [sameWindow],
  );

  const runtime = useMemo<ChatRuntime>(() => {
    // On the WEB, Guide-mode endpoints are SAME-ORIGIN relative `/content/*`
    // paths. The lib's `embedAuthedFetch` rejects cross-origin URLs in
    // production builds (bearer + cookies must not leak across origins);
    // keeping these relative means the browser always calls the page origin
    // and the guard passes in every build. The Next.js `rewrites()` (see
    // `next.config.mjs`) forwards `/content/*` to the tenant gateway, and in
    // a same-origin production deployment the platform reverse proxy answers
    // it before Next does. In the NATIVE SHELL neither exists (static export
    // on `capacitor://localhost`), so `CONTENT_ORIGIN` absolutizes the base
    // to the tenant gateway — the origin `CHAT_AUTH_ADAPTER.allowedOrigins`
    // sanctions for the guard. Same split as `help-center/endpoints.ts`.
    const contentBase = `${CONTENT_ORIGIN}/content`;
    const content = (path: string): string => `${contentBase}${path}`;

    return {
      endpoints: {
        // Upstream paths verified live against the deployed instance
        // (2026-05-29 endpoint table).
        chatStreamUrl: content('/api/docs/chat'),
        approvalToolUrl: content('/api/chat/agent/confirm-tool'),
        // Help Center ticket agent endpoints — proxied under `/content` like
        // every other endpoint, so they route through the existing `/content/*`
        // rewrite (dev) + platform reverse-proxy (prod). No bare `/api/chat/agent/*`
        // hatch needed.
        findTicketUrl: content('/api/chat/agent/find-ticket'),
        ticketActionUrl: content('/api/chat/agent/ticket-action'),
        listEngagementsUrl: content('/api/chat/agent/list-engagements'),
        // Ticket live stream + read-receipt endpoints (TicketLiveProvider)
        // — same `/content` proxying as the three above. The stream is a
        // long-lived GET SSE response; the lib's fetch-based reader
        // carries the bearer via the embed auth adapter. The unread
        // summary has NO endpoint — it arrives as `ticket-summary`
        // frames on the stream and in ticket-read responses.
        ticketStreamUrl: content('/api/tickets/stream'),
        ticketReadUrl: content('/api/tickets/read'),
        commandsUrl: content('/api/docs/commands'),
        // Per-platform empty-state config (greeting + try-asking quick-action
        // chips + RAG-source filter), admin-edited in MPH's `/admin/chat-config`.
        // Same-origin relative `/content/*` path (see `commandsUrl`), proxied to
        // MPH. The lib fetches it at runtime because, as a cross-origin embedder,
        // we have no SSR hop to inject these as props the way MPH's in-app chat
        // does. Drives `emptyStateGreeting` + the Guide/Mingo quick-action chips.
        emptyStateUrl: content('/api/docs/empty-state'),
        // Per-AGENT public config (`/api/ai-agents/<slug>`, source-keyed on
        // `agent-<slug>`), the flat superset of the empty-state whose
        // `quickActions` are that agent's own admin-curated chips — NOT the
        // platform's. Same shape/owner as `emptyStateUrl` (both flow through
        // MPH's `resolveChatSurfaceDisplay`, one keyed by platform, the other
        // by `agent-<slug>`), and same same-origin `/content/*` proxy. Mirrors
        // flamingo.run's `aiAgentConfigUrl: (slug) => /api/ai-agents/<slug>`;
        // consumed by the "Meet Mingo" onboarding step to show the `agent-mingo`
        // agent's quick actions.
        aiAgentConfigUrl: (slug: string) => content(`/api/ai-agents/${encodeURIComponent(slug)}`),
        // RAG doc-search + relative-link resolver, read automatically by the
        // lib's doc-search surfaces (Help Center onboarding-guides catalog,
        // `<DocsHubPage>`). Without these the lib's fall-back chain lands on
        // bare `/api/docs/*` against OUR origin — a route this app doesn't
        // serve. An explicit `searchEndpoint` prop (knowledge-base page)
        // still wins over these.
        docsSearchUrl: content('/api/docs/search'),
        docsResolveLinkUrl: content('/api/docs/resolve-link'),
        // Fetch-mode entity cards (blog, roadmap, case study, release,
        // podcast/webinar/event, …) expand their `[card://<type>:<id>]`
        // markers by GETting the type's list endpoint. The lib owns the
        // non-obvious per-type URL shapes (`task_ids` vs `ids`, `pageSize`,
        // `&filter=all`, distinct paths); we just point its builder at the
        // `/content` reverse proxy so the URLs land on MPH. Returning null
        // here (the old TODO) left every such card with no URL → no fetch →
        // blank card.
        buildListUrl: (type, ids) => buildEntityCardListUrl(type, ids, contentBase),
        attachmentUploadUrl: content('/api/storage/generate-upload-url'),
        attachmentViewUrlPrefix: content('/api/storage/view/chat-attachments/'),
        // Identity endpoint = the MPH source route `app/api/auth/identity/route.ts`
        // (served at `/api/auth/identity`, proxied here under `/content`). The
        // previously-used `/api/chat/identity` returns the content app's
        // `/_not-found` (200 HTML) on this tenant host — verified 2026-06-15 via
        // `/help-center/tickets`: the authed GET reached MPH but matched no route,
        // so `useChatIdentity` fell back to `anon` and the signed-in ticket form
        // never showed. `/api/auth/identity` is the lib's documented hub default.
        identityUrl: content('/api/auth/identity'),
        imageProxyUrlPrefix: content('/api/image-proxy'),
        // Native `<track>` VTT endpoint behind every video surface (help-center
        // release / onboarding-guide players, chat video cards, the floating
        // walkthrough card). The lib builds caption URLs off the relative hub
        // default `/api/captions/…`, which resolves against THIS app's origin —
        // a route we don't serve, so toggling CC fetched a 404 and no subtitles
        // ever rendered. Pointing it at the same `/content` proxy as every other
        // endpoint puts the tracks back on MPH.
        captionsUrlPrefix: content('/api/captions'),
      },
      navigation: {
        // Host mode — identical to MPH's `HubRuntimeProvider`. See the file
        // header + the `navigate` / `decideNewTab` callbacks defined above.
        mode: 'host',
        navigate,
        decideNewTab,
        openExternal,
      },
      // Unified content-href seam (shared with Help Center pages): the hosted
      // types and the Help Center overrides soft-nav into `/help-center/...`;
      // every other type opens OUT to its hub home. See
      // `composeOpenframeInAppContentUrl`.
      composeContentUrl: composeOpenframeInAppContentUrl,
      source: CHAT_SOURCE,
    };
    // `navigate` / `decideNewTab` / `openExternal` are the only reactive deps.
    // The first two are stable `useCallback`s; `openExternal` changes only on a
    // resize across the md breakpoint, so the runtime object is rebuilt about as
    // often as never.
  }, [navigate, decideNewTab, openExternal]);

  return <ChatRuntimeContext.Provider value={runtime}>{children}</ChatRuntimeContext.Provider>;
}
