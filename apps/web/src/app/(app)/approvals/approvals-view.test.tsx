/**
 * The Needs approval page over its real sources (the viewer's approval notifications, the
 * chat service's waiting chats, the Tech Required tickets waiting on one) with only the
 * network faked: one list of every request (tickets on SaaS only), each once, a title that
 * opens what the request belongs to, the next page loaded as the list scrolls, and a
 * decision that lands on the page, the sidebar badge and the drawer.
 */

import { type Notification, NotificationsProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { clearApprovalDecisions, noteApprovalDecision } from '@/app/components/approvals/approval-decisions';
import { usePendingApprovalCount } from '@/app/components/mingo-shell/use-pending-approval-count';
import { routes } from '@/lib/routes';
import { ApprovalsView } from './approvals-view';

const { server, push, openMingoDialog, toast } = vi.hoisted(() => ({
  server: {
    saas: true,
    notifications: [] as Notification[],
    dialogs: [] as unknown[],
    tickets: [] as unknown[],
    /** The lane's second page; while non-empty the first one says there is more. */
    olderTickets: [] as unknown[],
    resolved: [] as Array<{ id: string; approve: boolean }>,
  },
  push: vi.fn<(href: string) => void>(),
  openMingoDialog: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/lib/api-client', () => {
  const ok = (data: unknown) => ({ ok: true, status: 200, data: { data } });
  return {
    apiClient: {
      post: vi.fn(async (_url: string, body: { query: string; variables?: { input?: never; cursor?: string } }) => {
        if (body.query.includes('GetApprovalDialogsCount')) {
          return ok({ dialogs: { filteredCount: server.dialogs.length } });
        }
        if (body.query.includes('GetPendingApprovalTicketsCount')) {
          return ok({ tickets: { filteredCount: server.tickets.length + server.olderTickets.length } });
        }
        if (body.query.includes('GetApprovalDialogs')) {
          return ok({
            dialogs: {
              edges: server.dialogs.map(node => ({ node })),
              pageInfo: { hasNextPage: false, endCursor: null },
              filteredCount: server.dialogs.length,
            },
          });
        }
        if (body.query.includes('ticketStatuses')) {
          return ok({
            ticketStatuses: [
              { id: 's-ai', name: 'AI', color: '#000000', position: 'a', kind: 'AI_ASSISTANCE', isSystem: true },
              { id: 's-tech', name: 'Tech', color: '#000000', position: 'b', kind: 'TECH_REQUIRED', isSystem: true },
            ],
          });
        }
        if (body.query.includes('GetPendingApprovalTickets')) {
          const older = body.variables?.cursor === 'page-2';
          const page = older ? server.olderTickets : server.tickets;
          const hasNextPage = !older && server.olderTickets.length > 0;
          return ok({
            tickets: {
              edges: page.map(node => ({ cursor: 'c', node })),
              pageInfo: {
                hasNextPage,
                hasPreviousPage: older,
                startCursor: null,
                endCursor: hasNextPage ? 'page-2' : null,
              },
              filteredCount: server.tickets.length + server.olderTickets.length,
            },
          });
        }
        if (body.query.includes('resolveApprovalRequest')) {
          const input = body.variables?.input as unknown as { id: string; approve: boolean };
          server.resolved.push(input);
          // Decided: the server no longer counts its chat as waiting.
          server.dialogs = server.dialogs.filter(
            dialog => (dialog as { pendingApproval: { id: string } }).pendingApproval.id !== input.id,
          );
          return ok({ resolveApprovalRequest: { userErrors: [] } });
        }
        throw new Error(`unexpected request: ${body.query}`);
      }),
    },
  };
});
vi.mock('@/graphql/notifications/approval-notifications-relay', () => ({
  fetchApprovalNotifications: vi.fn(async () => ({
    notifications: server.notifications,
    pageInfo: { hasNextPage: false, endCursor: null },
  })),
}));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => server.saas,
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChat: () => ({ chat: null, error: null, enabled: true }),
}));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => true }));
vi.mock('@/app/components/notifications/open-mingo-dialog', () => ({ openMingoDialog }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// jsdom has no ResizeObserver; the tile measures its command section and title with one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// The list's end: every observed sentinel, so a test can scroll it into view.
const sentinels = new Set<IntersectionObserverCallback>();
class IntersectionObserverStub {
  private readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe() {
    sentinels.add(this.callback);
  }
  disconnect() {
    sentinels.delete(this.callback);
  }
}
globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
async function scrollToEnd() {
  await act(async () => {
    for (const callback of [...sentinels]) {
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
  });
}

const TOOL_CALL = {
  toolExecutionRequestId: 'te-1',
  toolName: 'run_script',
  toolTitle: 'Restart spooler',
  toolExplanation: 'Restarts the print spooler',
  toolType: 'OPENFRAME_SCRIPT',
  requiresApproval: true,
  approvalType: 'ADMIN',
  toolCallArguments: { script: 'Restart-Service Spooler' },
};

const mingoChat = (dialogId: string, approvalId: string, createdAt: string) => ({
  id: `g-${dialogId}`,
  dialogId,
  title: `Chat ${dialogId}`,
  createdAt,
  pendingApproval: { id: approvalId, approvalType: 'ADMIN', explanation: null, createdAt, toolCalls: [TOOL_CALL] },
});

const techTicket = (ticketId: string, approvalId: string) => ({
  id: `g-${ticketId}`,
  ticketId,
  ticketNumber: 1152,
  title: 'Customer Service Request',
  owner: { type: 'CLIENT', machineId: 'm-1', machine: { id: 'm', machineId: 'm-1', hostname: 'LAPTOP-7' } },
  deviceHostname: 'LAPTOP-7',
  organizationName: 'Acme',
  createdAt: '2026-10-15T08:00:00Z',
  pendingApproval: { id: approvalId, approvalType: 'ADMIN', createdAt: '2026-10-16T07:00:00Z', toolCalls: [TOOL_CALL] },
});

const approvalNotification: Notification = {
  id: 'n-1',
  title: 'Approval required',
  description: 'Restarts the print spooler',
  createdAt: Date.parse('2026-10-16T11:00:00Z'),
  read: false,
  category: 'MINGO',
  meta: {
    notificationType: 'MINGO_APPROVAL_REQUEST',
    approvalRequestId: 'ar-1',
    dialogId: 'd-1',
    approvalType: 'ADMIN',
    resolution: 'PENDING',
    toolCalls: [TOOL_CALL],
  },
};

const markRead = vi.fn();
/** The sidebar badge's count, drawn where the test can read it. */
function BadgeProbe() {
  return <output data-badge>{usePendingApprovalCount()}</output>;
}

let container: HTMLDivElement;
let root: Root;
const badge = () => Number(container.querySelector('[data-badge]')?.textContent);

beforeEach(() => {
  server.saas = true;
  server.notifications = [];
  server.dialogs = [];
  server.tickets = [];
  server.olderTickets = [];
  server.resolved = [];
  push.mockReset();
  openMingoDialog.mockReset();
  markRead.mockReset();
  useAuthStore.setState({ user: { id: 'u-1', email: 'ann@example.com', firstName: 'Ann', lastName: 'Lee' } });
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

/** The viewer's approval notifications: in the drawer, and what the page's own query answers. */
async function renderPage(notifications: Notification[] = []) {
  server.notifications = notifications;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider initialNotifications={notifications} actions={{ onMarkRead: markRead }}>
          <BadgeProbe />
          <ApprovalsView />
        </NotificationsProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

/** The cards: the list's own items (a card's command section has lists of its own). */
const cards = () => [...container.querySelectorAll('ul[aria-label] > li')];
const cardTitled = (title: string) => cards().find(item => item.textContent?.includes(title)) ?? null;
const buttonIn = (element: Element | null, label: string) =>
  [...(element?.querySelectorAll('button') ?? [])].find(button => button.textContent === label) ?? null;

describe('ApprovalsView', () => {
  it("lists every request once, in two sections: Mingo's, then the tickets waiting on a technician", async () => {
    server.dialogs = [
      mingoChat('d-1', 'ar-1', '2026-10-16T10:00:00Z'),
      mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z'),
    ];
    server.tickets = [techTicket('t-5', 'ar-t5'), techTicket('t-6', 'ar-2')];
    await renderPage([approvalNotification]);

    expect(container.querySelector('[role="tablist"]')).toBeNull();
    // The notification's card, under its chat's name; the chat behind it is not a second card,
    // nor is the ticket whose request a chat already shows.
    expect(cardTitled('Chat d-1')).not.toBeNull();
    expect(cards()).toHaveLength(3);
    expect(cardTitled('LAPTOP-7 · Acme')?.textContent).toContain('1152: Customer Service Request');
    // The badge is the server's count of waiting chats and waiting tickets.
    expect(badge()).toBe(4);

    // Mingo's requests, then the tickets waiting for a technician, each under its count.
    const sections = [...container.querySelectorAll('section')].map(section => ({
      heading: section.querySelector('h2')?.textContent,
      cards: section.querySelectorAll('ul[aria-label] > li').length,
    }));
    expect(sections).toEqual([
      { heading: 'Approval requests · 2', cards: 2 },
      { heading: 'Tickets waiting for a technician · 1', cards: 1 },
    ]);
    expect(cardTitled('LAPTOP-7 · Acme')?.closest('section')?.querySelector('h2')?.textContent).toBe(
      'Tickets waiting for a technician · 1',
    );
    expect([...container.querySelectorAll('a')].some(link => link.textContent === 'Open board')).toBe(false);
  });

  it('has no tickets, and asks the chat service nothing, outside SaaS', async () => {
    server.saas = false;
    server.dialogs = [mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z')];
    server.tickets = [techTicket('t-5', 'ar-t5')];
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.post).mockClear();
    await renderPage([approvalNotification]);

    expect(cards()).toHaveLength(1);
    expect(container.textContent).not.toContain('Tickets waiting for a technician');
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(badge()).toBe(0);
  });

  it('opens the ticket, or the chat through the dialog-open seam, from the card title', async () => {
    server.dialogs = [mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z')];
    server.tickets = [techTicket('t-5', 'ar-t5')];
    await renderPage();

    const chatLink = cardTitled('Chat d-2')?.querySelector('a');
    expect(chatLink?.getAttribute('href')).toBe(routes.mingo.chat('d-2'));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      chatLink?.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(openMingoDialog).toHaveBeenCalledWith('d-2', { navigate: push });

    const ticketLink = cardTitled('1152: Customer Service Request')?.querySelector('a');
    expect(ticketLink?.getAttribute('href')).toBe(routes.tickets.dialog('t-5'));
  });

  it('a decision here lands on the page, the badge and the drawer; one made elsewhere takes the card off', async () => {
    server.dialogs = [
      mingoChat('d-1', 'ar-1', '2026-10-16T10:00:00Z'),
      mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z'),
    ];
    server.tickets = [techTicket('t-5', 'ar-t5')];
    await renderPage([approvalNotification]);
    expect(badge()).toBe(3);

    await act(async () => {
      buttonIn(cardTitled('Chat d-1'), 'Approve')?.click();
    });
    await settle();

    expect(server.resolved).toEqual([{ id: 'ar-1', approve: true }]);
    // Kept on the page with its decision; no longer pending anywhere.
    expect(cardTitled('Chat d-1')?.textContent).toContain('Approved');
    expect(cardTitled('Chat d-1')?.textContent).toContain('by Ann Lee');
    expect(buttonIn(cardTitled('Chat d-1'), 'Approve')).toBeNull();
    expect(badge()).toBe(2);
    // The drawer's tile is completed, as the drawer's own decision completes it.
    expect(markRead).toHaveBeenCalledWith('n-1');

    // Rejected in the chat (any surface records it through the same mutation).
    server.dialogs = server.dialogs.filter(dialog => (dialog as { dialogId: string }).dialogId !== 'd-2');
    act(() => noteApprovalDecision('ar-2', false));
    expect(cardTitled('Chat d-2')).toBeNull();
    await settle();
    expect(badge()).toBe(1);
  });

  it('loads the next page on its own as the end of the list shows — no paging buttons', async () => {
    // The first page adds no card (here a ticket whose request is gone); the next one does.
    server.tickets = [{ ...techTicket('t-4', 'unused'), pendingApproval: null }];
    server.olderTickets = [techTicket('t-5', 'ar-t5')];
    await renderPage();

    expect(cards()).toHaveLength(0);
    expect(container.textContent).not.toContain('Nothing needs approval');
    expect(buttonIn(container, 'Show more')).toBeNull();
    expect(buttonIn(container, 'Check older tickets')).toBeNull();

    await scrollToEnd();
    await settle();

    expect(cardTitled('LAPTOP-7 · Acme')).not.toBeNull();
  });

  it('heads each section with the total before the next page is loaded, the same once it is', async () => {
    server.dialogs = [mingoChat('d-1', 'ar-1', '2026-10-16T10:00:00Z')];
    server.tickets = [techTicket('t-1', 'ar-t1')];
    server.olderTickets = [techTicket('t-2', 'ar-t2')];
    await renderPage();

    expect(cards()).toHaveLength(2);
    const headings = () => [...container.querySelectorAll('h2')].map(heading => heading.textContent);
    expect(headings()).toEqual(['Approval requests · 1', 'Tickets waiting for a technician · 2']);
    expect(badge()).toBe(3);

    await scrollToEnd();
    await settle();

    expect(cards()).toHaveLength(3);
    expect(headings()).toEqual(['Approval requests · 1', 'Tickets waiting for a technician · 2']);
  });

  it('draws the ✓ "Mark notification complete" only on a card that is a notification', async () => {
    server.dialogs = [mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z')];
    server.tickets = [techTicket('t-5', 'ar-t5')];
    await renderPage([approvalNotification]);

    const complete = (card: Element | null) => card?.querySelector('button[aria-label="Mark notification complete"]');
    expect(complete(cardTitled('Approval required'))).not.toBeNull();
    expect(complete(cardTitled('Chat d-2'))).toBeNull();
    expect(complete(cardTitled('1152: Customer Service Request'))).toBeNull();
  });

  it('says nothing is waiting when nothing is', async () => {
    await renderPage();

    expect(container.textContent).toContain('Nothing needs approval');
    expect(cards()).toHaveLength(0);
    expect(badge()).toBe(0);
  });
});
