/**
 * Where a ticket's files came from: asked apart from the ticket only while the chat attachments flag is on, and shown
 * as "Added from chat" on a file a chat sent.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET_TICKET_ATTACHMENT_SOURCES_QUERY, ticketAttachmentSourceLabel } from './ticket-attachment-sources-query';
import { useTicketAttachmentSources } from './use-ticket-attachment-sources';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: api }));

const last: { value: ReadonlyMap<string, string> | undefined } = { value: undefined };

function Probe({ enabled }: { enabled: boolean }) {
  const { data } = useTicketAttachmentSources('t-1', { enabled });
  useEffect(() => {
    last.value = data;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function render(enabled: boolean) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe enabled={enabled} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  api.post.mockReset();
  last.value = undefined;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useTicketAttachmentSources', () => {
  it('asks nothing while the flag is off', async () => {
    await render(false);
    expect(api.post).not.toHaveBeenCalled();
    expect(last.value).toBeUndefined();
  });

  it("reads each file's source by id with its own document while the flag is on", async () => {
    api.post.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        data: {
          ticket: {
            id: 't-1',
            attachments: [
              { id: 'a1', source: 'CHAT' },
              { id: 'a2', source: 'UPLOAD' },
            ],
          },
        },
      },
    });
    await render(true);

    expect(api.post).toHaveBeenCalledWith('/chat/graphql', {
      query: GET_TICKET_ATTACHMENT_SOURCES_QUERY,
      variables: { id: 't-1' },
    });
    await vi.waitFor(() => expect(last.value?.get('a1')).toBe('CHAT'));
    expect(last.value?.get('a2')).toBe('UPLOAD');
  });
});

describe('ticketAttachmentSourceLabel', () => {
  it('labels a file a chat sent, and nothing else', () => {
    expect(ticketAttachmentSourceLabel('CHAT')).toBe('Added from chat');
    expect(ticketAttachmentSourceLabel('UPLOAD')).toBeUndefined();
    expect(ticketAttachmentSourceLabel(undefined)).toBeUndefined();
  });
});
