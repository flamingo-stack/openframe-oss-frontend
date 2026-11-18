'use client';

/**
 * Where a content record opens in OpenFrame: the lib's one embedder composer (`makeEmbedderComposeContentUrl`) with the
 * pages this app has for the hub's content. A record OpenFrame has a page for (a release or an onboarding guide, a
 * product doc in the Knowledge Base, the roadmap and delivery lists filtered to an item, the tickets list with a ticket
 * open, an FAQ at its question, the trust center) opens there, relative, so it soft-navigates; every other record opens
 * the address the server answers, on the content hub, in a new tab.
 *
 * Both `mode: 'host'` runtimes register it: `HelpCenterRuntimeProvider` (the `/help-center` subtree) and
 * `OpenframeChatRuntimeProvider` (the app-wide chat), so a page card, a chat card, a chip and a search result of one
 * record land on one page.
 *
 * The detail routes are query-param routes (`?slug=`): guide and release slugs are CMS content, so `output: 'export'`
 * cannot prerender a `[slug]` segment, and the native shell answers every unprerendered path with the root
 * `index.html`.
 *
 * `hubspot_ticket_anon` is deliberately not hosted: it is a cross-customer known issue, not the viewer's ticket, so the
 * session-scoped tickets list would answer "No tickets found".
 */

import { getPlatformCanonicalUrl } from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { type ComposeContentUrl, makeEmbedderComposeContentUrl } from '@flamingo-stack/openframe-frontend-core/utils';
import { routes } from '@/lib/routes';
import { KNOWLEDGE_BASE_ROUTE } from './endpoints';

export const composeOpenframeInAppContentUrl: ComposeContentUrl = makeEmbedderComposeContentUrl({
  // The content hub, for a record whose row names no address of its own.
  contentOrigin: getPlatformCanonicalUrl('flamingo'),
  routes: {
    onboardingGuide: routes.helpCenter.onboardingGuide,
    release: routes.helpCenter.release,
    knowledgeBase: KNOWLEDGE_BASE_ROUTE,
    roadmap: routes.helpCenter.roadmap,
    delivery: routes.helpCenter.bugFixesAndEnhancements,
    faqs: routes.helpCenter.faqs,
    tickets: routes.helpCenter.tickets,
    trustCenter: routes.helpCenter.trustCenter,
  },
});
