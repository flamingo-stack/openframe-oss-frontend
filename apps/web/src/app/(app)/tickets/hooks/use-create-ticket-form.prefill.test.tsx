/**
 * Pins the edit-mode prefill contract of `useCreateTicketForm`: the form is
 * seeded exactly once per ticket, from a fetch made after mount, and nothing
 * that happens afterwards — a parent re-render, an attachment change — resets
 * it over the user's edits.
 *
 * The first case is the shape of the regression this guards against: the
 * prefill effect listed `tempAttachments` (a new object per render) as a
 * dependency, and `form.reset` re-renders the `useForm` owner, so every render
 * scheduled the next one until React gave up with "Maximum update depth
 * exceeded".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketsQueryKeys } from '../utils/query-keys';
import { useCreateTicketForm } from './use-create-ticket-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// The tags barrel drags the pickers (and their Relay `graphql` tags) in; the
// form only needs the optimistic-id predicate.
vi.mock('@/app/components/shared/tags', () => vi.importActual('@/app/components/shared/tags/optimistic-tag-id'));

// The barrel drags the field component (and its Relay `graphql` tags) in; only
// the zod schema and the two hooks are needed here.
vi.mock('@/components/assignments', async () => {
  const schema = await vi.importActual('@/components/assignments/schema');
  return {
    ...schema,
    useAssignedItems: () => ({ value: {}, isReady: true, isLoading: false }),
    useApplyAssignmentsDiff: () => ({ mutateAsync: vi.fn() }),
  };
});

const TICKET = {
  id: 't1',
  ticketNumber: 1,
  title: 'Original title',
  description: 'Original description',
  status: 'ACTIVE',
  statusDefinition: { id: 's1', name: 'Open', color: '#000', kind: 'CUSTOM' },
  availableTransitions: [],
  owner: { type: 'ADMIN', userId: 'u1' },
  tags: [],
  attachments: [{ id: 'a1', fileName: 'f.txt', contentType: 'text/plain', fileSize: 1 }],
  notes: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(async (_url: string, body: { query?: string }) => {
      if (body.query?.includes('query GetTicket')) return { ok: true, data: { data: { ticket: TICKET } } };
      if (body.query?.includes('ticketStatuses')) return { ok: true, data: { data: { ticketStatuses: [] } } };
      return { ok: true, data: { data: {} } };
    }),
    get: vi.fn(async () => ({ ok: true, data: {} })),
  },
}));

const COMMIT_CAP = 200;

// Recorded from an effect, after each commit, rather than during render: the
// hook rules forbid writing module state from the render body.
const seen = {
  commits: 0,
  titles: [] as string[],
  hook: null as ReturnType<typeof useCreateTicketForm> | null,
};

function Harness({ tick }: { tick: number }) {
  const result = useCreateTicketForm({ ticketId: 't1' });
  useEffect(() => {
    seen.hook = result;
    seen.titles.push(result.form.getValues('title'));
    if (++seen.commits > COMMIT_CAP) throw new Error(`render loop: Harness committed more than ${COMMIT_CAP} times`);
  });
  return <span data-tick={tick} data-loaded={result.ticketLoaded} />;
}

function current() {
  if (!seen.hook) throw new Error('Harness has not rendered');
  return seen.hook;
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function settle(ms = 30) {
  await act(async () => {
    await sleep(ms);
  });
}

function render(tick: number) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness tick={tick} />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  seen.commits = 0;
  seen.titles = [];
  seen.hook = null;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  client.clear();
});

describe('useCreateTicketForm edit-mode prefill', () => {
  it('prefills once and then stops re-rendering', async () => {
    render(0);
    await settle();
    expect(current().form.getValues('title')).toBe('Original title');
    expect(current().ticketLoaded).toBe(true);

    const afterPrefill = seen.commits;
    await settle(100);
    expect(seen.commits - afterPrefill).toBeLessThan(5);
  }, 15_000);

  it('keeps a user edit across a parent re-render and an attachment change', async () => {
    render(0);
    await settle();
    expect(current().form.getValues('title')).toBe('Original title');

    act(() => {
      current().form.setValue('title', 'Edited by user');
    });
    render(1);
    await settle();
    expect(current().form.getValues('title')).toBe('Edited by user');

    // The upload fails against the stub — what matters is that `files` changes,
    // which is the dependency change the old prefill answered with a reset.
    await act(async () => {
      current().tempAttachments.uploadFile(new File(['x'], 'x.txt', { type: 'text/plain' }));
      await sleep(30);
    });
    expect(current().tempAttachments.files.some(f => f.fileName === 'x.txt')).toBe(true);
    expect(current().form.getValues('title')).toBe('Edited by user');
  }, 15_000);

  it('never seeds from a cached ticket; Save stays disabled until the post-mount fetch lands', async () => {
    client.setQueryData(ticketsQueryKeys.editForm('t1'), { ...TICKET, title: 'Stale cached title' });

    render(0);
    expect(current().ticketLoaded).toBe(false);
    await settle();

    expect(current().form.getValues('title')).toBe('Original title');
    expect(current().ticketLoaded).toBe(true);
    expect(seen.titles).not.toContain('Stale cached title');
  }, 15_000);
});
