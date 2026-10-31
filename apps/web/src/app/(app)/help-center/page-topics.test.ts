import { pageTopicFor } from '@flamingo-stack/openframe-frontend-core/utils/page-topics';
import { describe, expect, it } from 'vitest';
import { PAGE_TOPICS } from './page-topics';

describe('PAGE_TOPICS', () => {
  it('names the topic of every product screen, and of the pages under it', () => {
    expect(pageTopicFor('/mingo', PAGE_TOPICS)).toBe('mingo');
    expect(pageTopicFor('/mingo/chat', PAGE_TOPICS)).toBe('mingo');
    expect(pageTopicFor('/devices', PAGE_TOPICS)).toBe('devices');
    expect(pageTopicFor('/devices/details', PAGE_TOPICS)).toBe('devices');
    expect(pageTopicFor('/tickets', PAGE_TOPICS)).toBe('helpdesk-tickets');
    expect(pageTopicFor('/log-details', PAGE_TOPICS)).toBe('logs');
  });

  it('keeps the Help Center pages on the hub page they mirror', () => {
    expect(pageTopicFor('/help-center/tickets', PAGE_TOPICS)).toBe('tickets');
    expect(pageTopicFor('/help-center/knowledge-base', PAGE_TOPICS)).toBe('knowledge-base');
    expect(pageTopicFor('/help-center/releases/detail', PAGE_TOPICS)).toBe('product_release');
  });

  it('gives a page with no entry no topic', () => {
    expect(pageTopicFor('/auth/login', PAGE_TOPICS)).toBeNull();
  });
});
