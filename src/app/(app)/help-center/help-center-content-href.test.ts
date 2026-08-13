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

import { describe, expect, it } from 'vitest';
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
    expect(href({ type: 'hubspot_ticket', identifier: 'T-1' })).toBe('/help-center/tickets?ticket=T-1');
    expect(href({ type: 'faq', identifier: 'q1' })).toContain('/help-center/faqs#');
  });

  it('keeps hub-only types on the absolute content-hub origin', () => {
    expect(href({ type: 'blog_post', identifier: 'my-post' })).toBe('https://www.flamingo.run/blog/my-post');
    // The RAG hands back RELATIVE externalUrls for content we do not host.
    expect(href({ type: 'webinar', identifier: 'x', externalUrl: 'webinars/abc' })).toBe(
      'https://www.flamingo.run/webinars/abc',
    );
  });
});
