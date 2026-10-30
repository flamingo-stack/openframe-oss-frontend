import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AssignedItemsContent } from './assigned-items-view';
import type { AssignedItemsResult } from './use-assigned-items';

vi.mock('react-relay', () => ({ graphql: () => null, useFragment: (_: unknown, ref: unknown) => ref }));

const read = (over: Partial<AssignedItemsResult>): AssignedItemsResult => ({
  value: {},
  isLoading: false,
  loadingTypes: {},
  isReady: true,
  isOffline: false,
  loadFailed: false,
  retry: () => undefined,
  ...over,
});

const draw = (assigned: AssignedItemsResult) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AssignedItemsContent assigned={assigned} itemType="KNOWLEDGE_ARTICLE" />
    </QueryClientProvider>,
  );

describe('AssignedItemsContent', () => {
  it('draws no section for an item with no assignments', () => {
    expect(draw(read({}))).toBe('');
  });

  it('draws the section while the read is on its way', () => {
    expect(draw(read({ isLoading: true }))).toContain('Assigned Items');
  });

  it('says a failed read failed and offers the retry', () => {
    const html = draw(read({ loadFailed: true }));
    expect(html).toContain('load assigned items');
    expect(html).toContain('Retry');
  });

  it('offers no retry while the read waits for the connection', () => {
    const html = draw(read({ loadFailed: true, isOffline: true }));
    expect(html).toContain('offline');
    expect(html).not.toContain('Retry');
  });
});
