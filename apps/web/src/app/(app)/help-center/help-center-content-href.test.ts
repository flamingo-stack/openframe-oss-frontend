/**
 * Pins the content-href seam that THREE surfaces share (page entity cards, chat
 * cards/source chips, the RAG search dropdown) — a regression here silently sends
 * every one of them to the wrong place.
 *
 * The hosted-type cases are the ones that broke: the lib composes `/<suffix>/<slug>`,
 * but a slugged path SEGMENT is unroutable under `output: 'export'`, so the native
 * shell served the root `index.html` and the app hard-reloaded at `/` instead of
 * opening the guide.
 */

import {
  type ChatRef,
  resolveCardDestination,
  resolveSourceRowCTA,
  type SourceRowContext,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { platformOfUrl } from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_BASE_ROUTE } from './endpoints';
import { composeOpenframeInAppContentUrl } from './help-center-content-href';

const href = (input: Parameters<typeof composeOpenframeInAppContentUrl>[0]) =>
  composeOpenframeInAppContentUrl(input).href;

describe('composeOpenframeInAppContentUrl', () => {
  it('routes hosted types to the query-param detail route (page cards pass the slug)', () => {
    expect(href({ type: 'onboarding_guide', identifier: 'guide-7' })).toBe(
      '/help-center/onboarding-guides/detail?slug=guide-7',
    );
    expect(href({ type: 'product_release', identifier: 'v1-2-0' })).toBe('/help-center/releases/detail?slug=v1-2-0');
  });

  it('recovers the slug from externalUrl for chat rows, whose identifier is the primary key', () => {
    expect(
      href({
        type: 'product_release',
        identifier: '86ad3qvv5',
        externalUrl: 'https://www.flamingo.run/releases/from-the-url',
      }),
    ).toBe('/help-center/releases/detail?slug=from-the-url');
  });

  it('leaves the in-app overrides untouched — they already target prerendered routes', () => {
    expect(href({ type: 'roadmap_item', identifier: '86ad3qvv5' })).toBe('/help-center/roadmap?search=86ad3qvv5');
    expect(href({ type: 'faq', identifier: 'q1' })).toContain('/help-center/faqs#');
    expect(href({ type: 'trust_center', identifier: 'main' })).toBe('/help-center/trust-center');
  });

  it('builds ticket deep links through the lib SSOT, on OUR tickets surface', () => {
    // `&search=` is what makes a ticket outside the first page of the list open
    // at all; `/help-center/tickets` is ours, `/tickets` is the ticket board.
    for (const type of ['hubspot_ticket', 'hubspot_ticket_self']) {
      expect(href({ type, identifier: 'T-1' })).toBe('/help-center/tickets?ticket=T-1&search=T-1#ticket-T-1');
    }
  });

  it('does not re-home anonymized known-issue tickets onto the viewer tickets list', () => {
    // They belong to other customers, so `/help-center/tickets` cannot find them.
    expect(href({ type: 'hubspot_ticket_anon', identifier: 'T-1' })).not.toContain('/help-center/tickets');
  });

  it("opens a cited document in this app's Knowledge Base, at its tree path, in the same tab", () => {
    // A doc row (the lib's doc-table types) carries its tree path as the slug and no externalUrl.
    const composed = composeOpenframeInAppContentUrl({
      type: 'markdown',
      identifier: 'doc-42',
      slug: 'agents/install-on-windows',
    });
    expect(composed.href).toBe('/help-center/knowledge-base/agents/install-on-windows');
    expect(composed.targetPlatform).toBeNull();
    expect(href({ type: 'markdown', identifier: 'doc-7', slug: 'getting-started' })).toBe(
      '/help-center/knowledge-base/getting-started',
    );
  });

  // CU-17tkuw61kfy: a product doc in the chat opens this app's knowledge base, by the same composer as every card.
  it('opens a product doc (its tree path as the slug) in the in-app knowledge base', () => {
    expect(href({ type: 'markdown', identifier: 'd1', slug: 'openframe-cli/getting-started/quick-start.md' })).toBe(
      `${KNOWLEDGE_BASE_ROUTE}/openframe-cli/getting-started/quick-start.md`,
    );
  });

  it('keeps hub-only types on the absolute content-hub origin', () => {
    expect(href({ type: 'blog_post', identifier: 'my-post' })).toBe('https://www.flamingo.run/blog/my-post');
    expect(href({ type: 'webinar', identifier: 'x', externalUrl: 'https://www.flamingo.run/webinars/abc' })).toBe(
      'https://www.flamingo.run/webinars/abc',
    );
  });
});

/**
 * A source chip and a card for one record land on one page, and that page comes from the url the server answers. The
 * chip reads a source part, the card its fetched row; both go through this app's composer.
 */
describe('a chip and a card of the same record, with the server url', () => {
  const ctx: SourceRowContext = { composeContentUrl: composeOpenframeInAppContentUrl };
  const ref = (type: string, id: string, url: string | null): ChatRef => ({ type, id, title: id, url });

  function card(type: string, id: string, url: string) {
    return resolveCardDestination({ chatRef: ref(type, id, null), item: { url }, ctx });
  }
  function chip(type: string, id: string, url: string) {
    return resolveSourceRowCTA(
      { documentType: type, id, title: id, externalUrl: url, targetPlatform: platformOfUrl(url), path: null },
      ctx,
    );
  }

  const RECORDS: Array<{ type: string; id: string; url: string; opensAt: string; hostRoute: boolean }> = [
    {
      type: 'product_release',
      id: '86ad3qvv5',
      url: 'https://www.flamingo.run/releases/v1-2-0',
      opensAt: '/help-center/releases/detail?slug=v1-2-0',
      hostRoute: true,
    },
    {
      type: 'markdown',
      id: 'openframe-cli/getting-started/quick-start.md',
      url: 'https://hub.openframe.ai/knowledge-base/openframe-cli/getting-started/quick-start.md',
      opensAt: `${KNOWLEDGE_BASE_ROUTE}/openframe-cli/getting-started/quick-start.md`,
      hostRoute: true,
    },
    {
      type: 'faq',
      id: 'q1',
      url: 'https://www.flamingo.run/faqs#faq-item-q1',
      opensAt: '/help-center/faqs#faq-item-q1',
      hostRoute: true,
    },
    {
      type: 'blog_post',
      id: '1108',
      url: 'https://www.flamingo.run/blog/openframe-vs-atera',
      opensAt: 'https://www.flamingo.run/blog/openframe-vs-atera',
      hostRoute: false,
    },
  ];

  for (const { type, id, url, opensAt, hostRoute } of RECORDS) {
    it(`${type} opens at ${opensAt}, from either`, () => {
      expect(chip(type, id, url).href).toBe(opensAt);
      const destination = card(type, id, url);
      expect(destination.url).toBe(opensAt);
      expect(destination.hostRoute).toBe(hostRoute);
    });
  }

  it('keeps the whole tree path of a document, which the last segment of its url would lose', () => {
    expect(
      href({
        type: 'markdown',
        identifier: 'openframe-cli/README.md',
        externalUrl: 'https://hub.openframe.ai/knowledge-base/openframe-cli/README.md',
      }),
    ).toBe(`${KNOWLEDGE_BASE_ROUTE}/openframe-cli/README.md`);
  });
});
