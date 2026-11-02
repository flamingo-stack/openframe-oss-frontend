/**
 * The sidebar's "Needs approval" badge is the server's count of the requests waiting for a
 * decision: the Mingo chats waiting on one plus the Tech Required tickets waiting on one.
 * Nothing is fetched behind the subscription lock, and a chat that starts waiting or a
 * decision on any surface refreshes the count at once instead of at the next poll.
 */

import type { DialogItem } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { NotificationsProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApprovalDecisions, noteApprovalDecision } from '@/app/components/approvals/approval-decisions';
import { usePendingApprovalCount } from './use-pending-approval-count';

const { server, gate, session } = vi.hoisted(() => ({
  server: { waitingChats: 0, waitingTickets: 0, techRequired: true, requests: [] as string[] },
  gate: { open: true },
  session: {
    rows: [] as Array<{ id: string; title: string }>,
    waiting: new Set<string>(),
  },
}));

vi.mock('@/lib/api-client', () => {
  const ok = (data: unknown) => ({ ok: true, status: 200, data: { data } });
  return {
    apiClient: {
      post: vi.fn(async (_url: string, body: { query: string }) => {
        if (body.query.includes('GetApprovalDialogsCount')) {
          server.requests.push('chats');
          return ok({ dialogs: { filteredCount: server.waitingChats } });
        }
        if (body.query.includes('GetPendingApprovalTicketsCount')) {
          server.requests.push('tickets');
          return ok({ tickets: { filteredCount: server.waitingTickets } });
        }
        if (body.query.includes('ticketStatuses')) {
          server.requests.push('statuses');
          return ok({
            ticketStatuses: server.techRequired
              ? [{ id: 's-tech', name: 'Tech', color: '#000000', position: 'b', kind: 'TECH_REQUIRED', isSystem: true }]
              : [],
          });
        }
        throw new Error(`unexpected request: ${body.query}`);
      }),
    },
  };
});
vi.mock('@/graphql/notifications/approval-notifications-relay', () => ({ fetchApprovalNotifications: vi.fn() }));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => true,
}));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => gate.open }));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChat: () => ({
    enabled: true,
    error: null,
    chat: {
      state: { dialogs: [...session.rows] },
      dialogStatusOf: (dialog: DialogItem) => (session.waiting.has(dialog.id) ? 'approval' : undefined),
    },
  }),
}));

/** The badge's count, drawn where the test can read it. */
function Badge() {
  return <output data-badge>{usePendingApprovalCount()}</output>;
}

let container: HTMLDivElement;
let root: Root;
const badge = () => Number(container.querySelector('[data-badge]')?.textContent);
const requestsOf = (kind: string) => server.requests.filter(request => request === kind).length;
let queryClient: QueryClient;

beforeEach(() => {
  server.waitingChats = 0;
  server.waitingTickets = 0;
  server.techRequired = true;
  server.requests = [];
  gate.open = true;
  session.rows = [];
  session.waiting = new Set();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearApprovalDecisions();
});

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

async function render() {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider initialNotifications={[]}>
          <Badge />
        </NotificationsProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

describe('usePendingApprovalCount', () => {
  it('asks for nothing behind the subscription lock', async () => {
    gate.open = false;
    server.waitingChats = 2;
    await render();

    expect(server.requests).toEqual([]);
    expect(badge()).toBe(0);
  });

  it('adds the waiting chats and the waiting Tech Required tickets the server counts', async () => {
    server.waitingChats = 2;
    server.waitingTickets = 3;
    await render();

    expect(badge()).toBe(5);
  });

  it('counts only the chats on a tenant without a Tech Required lane', async () => {
    server.techRequired = false;
    server.waitingChats = 2;
    server.waitingTickets = 3;
    await render();

    expect(badge()).toBe(2);
    expect(requestsOf('tickets')).toBe(0);
  });

  it('refreshes at once when the open chat starts waiting on an approval', async () => {
    await render();
    expect(badge()).toBe(0);
    expect(requestsOf('chats')).toBe(1);

    // The chat on screen asked for approval: its stream says so, and no notification comes.
    server.waitingChats = 1;
    session.rows = [{ id: 'd-1', title: 'Chat d-1' }];
    session.waiting = new Set(['d-1']);
    await render();

    expect(requestsOf('chats')).toBe(2);
    expect(badge()).toBe(1);
  });

  it('refreshes at once when any surface decides a request', async () => {
    server.waitingChats = 2;
    await render();
    expect(badge()).toBe(2);

    server.waitingChats = 1;
    act(() => noteApprovalDecision('ar-9', true));
    await settle();

    expect(badge()).toBe(1);
  });
});
