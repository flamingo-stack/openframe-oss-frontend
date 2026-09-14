'use client';

/**
 * SINGLE SOURCE OF TRUTH for "where does a content entity card go in OpenFrame".
 *
 * OpenFrame hosts part of the hub's content in-app under `/help-center`, by two
 * different mechanisms: `hostedTypes` for the types with their own
 * detail route (product releases, onboarding guides), and `overrides` for the
 * ones that land on an EXISTING in-app route instead — roadmap and
 * delivery/bug-fixes deep-link into their list views, HubSpot tickets open the
 * tickets list with the row pre-opened, an FAQ card jumps to its question's
 * anchor. Every other type (blog / podcast / case-study / …) lives only on the
 * Flamingo content hub. This module encodes that split ONCE so every runtime
 * agrees; count the two maps below rather than trusting a number in prose.
 *
 * Both `mode: 'host'` runtimes — `HelpCenterRuntimeProvider` (the
 * `/help-center` subtree) and `OpenframeChatRuntimeProvider` (the app-wide
 * Guide/Mingo drawer) — wire the SAME composer,
 * {@link composeOpenframeInAppContentUrl}: in-app types stay RELATIVE
 * (`/help-center/...` → `isCrossOriginUrl` false → same-tab soft-nav) and
 * everything else is forced onto the ABSOLUTE content-hub origin (→ new tab).
 *
 * THREE surfaces consume the seam, so a single edit here moves all of them:
 *   - page entity cards (the lib's `resolveContentHref`),
 *   - chat cards / source chips (`resolveSourceRowCTA`),
 *   - the RAG search dropdown (`useDocSearch` → `resolveSearchResultAction`),
 *     which used to navigate to the RAG's canonical hub URL and land on
 *     `/onboarding-guides/<slug>` — a route that does not exist here.
 */

import {
  buildTicketOpenHref,
  type ComposeContentUrl,
  DEFAULT_CONTENT_SUFFIXES,
  DEV_SECTION_PARAM_KEYS,
  faqItemAnchor,
  makeComposeContentUrl,
} from '@flamingo-stack/openframe-frontend-core/utils';
import { routes } from '@/lib/routes';
import { HELP_CENTER_BASE } from './endpoints';

/** Public origin of the Flamingo content hub — fallback for content types Help
 *  Center does NOT host in-app (blog / podcast / case-study / …). */
const CONTENT_HUB_ORIGIN = 'https://www.flamingo.run';

/** Slash-less section base (`'help-center'`) — content suffixes are slash-less. */
const HC = HELP_CENTER_BASE.replace(/^\//, '');

/** Types Help Center hosts on their own detail route → relative in-app href
 *  (soft-nav). The lib's hosted branch emits `/<suffix>/<slug>`; {@link toDetailRoute}
 *  then rewrites that into this app's query-param detail route. The list-filter
 *  types (roadmap, delivery) are NOT here — they have no detail route and use
 *  `overrides` instead. */
const HOSTED_TYPES = new Set(['onboarding_guide', 'product_release']);

/** List path the lib composes into → this app's detail-route builder for that
 *  type. Keyed on the composed href rather than the content type because the lib
 *  canonicalizes rail-vocab aliases internally, so the emitted path is the one
 *  thing both hosted types are guaranteed to agree on. */
const DETAIL_ROUTE_BY_LIST_PATH: Record<string, (slug: string) => string> = {
  [routes.helpCenter.onboardingGuides]: routes.helpCenter.onboardingGuide,
  [routes.helpCenter.releases]: routes.helpCenter.release,
};

/**
 * `/help-center/releases/v1-2-0` → `/help-center/releases/detail?slug=v1-2-0`.
 *
 * The lib hardcodes `/<suffix>/<slug>` for hosted types, but a slugged SEGMENT is
 * unroutable in this app: guide/release slugs are CMS content, so `output: 'export'`
 * cannot prerender them, and the native shell answers every unprerendered path with
 * the root `index.html` — the nav failed its RSC fetch and hard-reloaded the app at
 * `/` instead of opening the guide. Non-hosted (absolute hub) hrefs and the
 * `overrides` deep-links miss the map and pass through untouched.
 */
function toDetailRoute(href: string): string {
  const cut = href.lastIndexOf('/');
  const build = DETAIL_ROUTE_BY_LIST_PATH[href.slice(0, cut)];
  return build ? build(href.slice(cut + 1)) : href;
}

/** In-app href for a HubSpot-ticket card → the Help Center tickets list with the
 *  ticket pre-opened. Built by the lib's `buildTicketOpenHref`, the SSOT every
 *  ticket deep link goes through: besides `?ticket=` (the param `HelpCenterList`
 *  derives its drawer state from) it emits `&search=` and `#ticket-`, and the
 *  search half is load-bearing — without it a ticket that sorts onto page 2+ is
 *  not in the loaded list and the drawer silently fails to open. Only the base
 *  differs from the hub's: OUR tickets surface is `/help-center/tickets`, not
 *  `/tickets` (which in this app is the unrelated ticket board). Shared by every
 *  `hubspot_ticket*` override. */
const helpCenterTicketHref = (id: string): { href: string; targetPlatform: string | null } => ({
  href: buildTicketOpenHref(`${HELP_CENTER_BASE}/tickets`, id),
  targetPlatform: null,
});

/** The lib's raw resolution, still carrying `/<suffix>/<slug>` for hosted types.
 *  Wrapped by {@link composeOpenframeContentUrl}, which rewrites those into this
 *  app's detail routes — nothing outside this module should read it. */
const composeLibContentUrl = makeComposeContentUrl({
  hostedTypes: HOSTED_TYPES,
  // Prefix the two hosted types' suffixes with the section base so their in-app
  // href is `/help-center/onboarding-guides/<slug>` etc.; keep the lib defaults
  // for every other type (used with `contentOrigin` for non-hosted fallback).
  suffixes: {
    ...DEFAULT_CONTENT_SUFFIXES,
    onboarding_guide: `${HC}/onboarding-guides`,
    product_release: `${HC}/releases`,
  },
  contentOrigin: CONTENT_HUB_ORIGIN,
  // List-filter types deep-link into their EXISTING in-app list route with the
  // `?search=<id>` param `DevSectionView` writes and the views read.
  overrides: {
    roadmap_item: id => ({
      href: `${HELP_CENTER_BASE}/roadmap?${DEV_SECTION_PARAM_KEYS.search}=${encodeURIComponent(id)}`,
      targetPlatform: null,
    }),
    delivery_item: id => ({
      href: `${HELP_CENTER_BASE}/bug-fixes-and-enhancements?${DEV_SECTION_PARAM_KEYS.search}=${encodeURIComponent(id)}`,
      targetPlatform: null,
    }),
    // Mingo entity cards with a real in-app destination → soft-nav in the chat
    // (and same-origin nav on the pages) instead of bouncing to the content hub.
    // A HubSpot-ticket card opens the Help Center tickets list with that ticket
    // pre-opened (every variant the RAG can emit); a FAQ card deep-links to its
    // specific question via the `#faq-item-<id>` hash the FAQ page dispatches on
    // (same anchor the hub uses) — `faqItemAnchor` is the lib's SSOT for it. Both
    // live under `/help-center`, so `isInAppHelpCenterHref` already covers them.
    hubspot_ticket: helpCenterTicketHref,
    hubspot_ticket_anon: helpCenterTicketHref,
    hubspot_ticket_self: helpCenterTicketHref,
    faq: id => ({ href: `${HELP_CENTER_BASE}/faqs#${faqItemAnchor(id)}`, targetPlatform: null }),
  },
});

/**
 * Base composer: RELATIVE in-app hrefs for the hosted types and the Help Center
 * `overrides`, the RAG `externalUrl` (or the hub origin) for everything else.
 * Not wired directly — {@link composeOpenframeInAppContentUrl} wraps it to force
 * non-hosted hrefs absolute, which is what BOTH runtimes register.
 */
export const composeOpenframeContentUrl: ComposeContentUrl = input => {
  const resolved = composeLibContentUrl(input);
  return { ...resolved, href: toDetailRoute(resolved.href) };
};

/** True when a composed href points at an in-app `/help-center` route (i.e. the
 *  relative-same-origin branch of {@link composeOpenframeContentUrl}). Every
 *  in-app target — content detail routes, the roadmap/delivery list filters, the
 *  ticket list, the FAQ list — lives under `/help-center`. */
export function isInAppHelpCenterHref(href: string): boolean {
  return href === HELP_CENTER_BASE || href.startsWith(`${HELP_CENTER_BASE}/`);
}

/** True when `href` is already absolute (`https://…` or protocol-relative `//…`). */
function isAbsoluteHref(href: string): boolean {
  return /^(?:https?:)?\/\//i.test(href);
}

/**
 * Force a hub-owned href onto the content-hub origin. The RAG can hand back a
 * RELATIVE `externalUrl` for content we do NOT host (observed: webinar
 * `externalUrl: 'webinars/<id>'`). openframe runs the chat in `host` mode
 * (identical to the hub), so a relative href would resolve against OUR origin and
 * 404 — the hub gets away with relative hrefs only because it hosts every content
 * type. We host just the `/help-center/*` subset, so every OTHER type must be an
 * ABSOLUTE hub URL to open externally. Already-absolute hrefs (incl. cross-platform
 * ones like an openmsp podcast) pass through untouched.
 */
function toHubOriginHref(href: string): string {
  if (isAbsoluteHref(href)) return href;
  return `${CONTENT_HUB_ORIGIN}/${href.replace(/^\/+/, '')}`;
}

/**
 * The composer BOTH runtimes register, shaped for the lib's HOST-mode nav
 * decision (`decideNewTab` → `isCrossOriginUrl` origin-compare / `targetPlatform`
 * vs our `source`). Splits on what openframe hosts in-app:
 *
 *   - `/help-center/*` types → keep the href RELATIVE (+ `targetPlatform: null`).
 *     `isCrossOriginUrl('/help-center/…')` is false → SAME-tab soft-nav that the
 *     browser resolves against OUR origin. (Absolutizing to our origin would
 *     backfire: `isCrossOriginUrl` counts EVERY absolute URL as cross-origin and
 *     would force a redundant new tab.)
 *   - everything else lives on the content hub → an ABSOLUTE hub URL, and
 *     `targetPlatform: null` so the new-tab decision falls to the origin compare
 *     (cross-origin hub URL → NEW tab). We must DROP the row's `targetPlatform`
 *     here: the RAG tags openframe content `targetPlatform: 'openframe'`, which
 *     equals our `source` and would flip `decideNewTab` to same-tab → the click
 *     handler strips the origin and `router.push`es a `/webinars/<id>` path that
 *     404s on our origin (the reported bug).
 *
 * The Help Center subtree registers this same wrapper (not the bare
 * {@link composeOpenframeContentUrl}) because the RAG search dropdown resolves
 * through the seam too: a hub-only row there would otherwise inherit the RAG's
 * possibly-relative `externalUrl` and 404 on our origin, exactly like the chat
 * bug above.
 */
export const composeOpenframeInAppContentUrl: ComposeContentUrl = input => {
  const resolved = composeOpenframeContentUrl(input);
  // Spread, never rebuild: `hostOverride` rides along on the fields we are NOT
  // deciding here, and it is what makes a fetch-mode chat card prefer this
  // answer over the destination the content hub minted for its own surface
  // (`pickFetchedCardHref`). Rebuilding the object dropped it silently — the
  // whole `overrides` map below went dead for `hubspot_ticket*` / `faq` cards.
  if (isInAppHelpCenterHref(resolved.href)) {
    return { ...resolved, targetPlatform: null };
  }
  return { ...resolved, href: toHubOriginHref(resolved.href), targetPlatform: null };
};
