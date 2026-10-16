/**
 * The sidebar's "Needs approval" badge counts what the Needs approval page lists as
 * pending, from shared caches: nothing is fetched behind the subscription lock, a chat
 * that starts waiting on an approval refreshes the count at once instead of at the next
 * poll, and a decision on any surface takes its request off immediately.
 */

import type { DialogItem } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { type Notification, NotificationsProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApprovalDecisions, noteApprovalDecision } from '@/app/components/approvals/approval-decisions';
import { usePendingApprovalCount } from './use-pending-approval-count';

const { server, gate, session } = vi.hoisted(() => ({
  server: { dialogs: [] as unknown[], requests: [] as string[] },
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
        if (body.query.includes('GetApprovalDialogs')) {
          server.requests.push('dialogs');
          return ok({
            dialogs: {
              edges: server.dialogs.map(node => ({ node })),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          });
        }
        if (body.query.includes('ticketStatuses')) {
          server.requests.push('statuses');
          return ok({ ticketStatuses: [] });
        }
        throw new Error(`unexpected request: ${body.query}`);
      }),
    },
  };
});
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

const waitingChat = (dialogId: string, approvalId: string) => ({
  id: `g-${dialogId}`,
  dialogId,
  title: `Chat ${dialogId}`,
  createdAt: '2026-10-16T10:00:00Z',
  pendingApproval: { id: approvalId, approvalType: 'ADMIN', createdAt: '2026-10-16T10:00:00Z', toolCalls: [] },
});

const approvalNotification: Notification = {
  id: 'n-1',
  title: 'Approval required',
  createdAt: Date.parse('2026-10-16T11:00:00Z'),
  read: false,
  category: 'MINGO',
  meta: {
    notificationType: 'MINGO_APPROVAL_REQUEST',
    approvalRequestId: 'ar-9',
    dialogId: 'd-9',
    resolution: 'PENDING',
    toolCalls: [],
  },
};

/** The badge's count, drawn where the test can read it. */
function Badge() {
  return <output data-badge>{usePendingApprovalCount()}</output>;
}

let container: HTMLDivElement;
let root: Root;
const badge = () => Number(container.querySelector('[data-badge]')?.textContent);
let queryClient: QueryClient;

beforeEach(() => {
  server.dialogs = [];
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

async function render(notifications: Notification[] = []) {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider initialNotifications={notifications}>
          <Badge />
        </NotificationsProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

describe('usePendingApprovalCount', () => {
  it('asks for nothing behind the subscription lock and counts the drawer’s requests', async () => {
    gate.open = false;
    server.dialogs = [waitingChat('d-1', 'ar-1')];
    await render([approvalNotification]);

    expect(server.requests).toEqual([]);
    expect(badge()).toBe(1);
  });

  it('counts each request once across the drawer and the waiting chats', async () => {
    server.dialogs = [waitingChat('d-9', 'ar-9'), waitingChat('d-1', 'ar-1')];
    await render([approvalNotification]);

    expect(badge()).toBe(2);
  });

  it('refreshes at once when the open chat starts waiting on an approval', async () => {
    await render();
    expect(badge()).toBe(0);
    expect(server.requests.filter(request => request === 'dialogs')).toHaveLength(1);

    // The chat on screen asked for approval: its stream says so, and no notification comes.
    server.dialogs = [waitingChat('d-1', 'ar-1')];
    session.rows = [{ id: 'd-1', title: 'Chat d-1' }];
    session.waiting = new Set(['d-1']);
    await render();

    expect(server.requests.filter(request => request === 'dialogs')).toHaveLength(2);
    expect(badge()).toBe(1);
  });

  it('drops a request the moment any surface decides it', async () => {
    server.dialogs = [waitingChat('d-1', 'ar-1')];
    await render([approvalNotification]);
    expect(badge()).toBe(2);

    act(() => noteApprovalDecision('ar-9', true));
    expect(badge()).toBe(1);
  });
});
