/**
 * The Needs approval page over its real sources (the drawer's notification state, the
 * chat service's waiting chats, the Tech Required lane) with only the network faked:
 * each request once, tickets on SaaS only, a title that opens what the request belongs
 * to, and a decision that lands on the page, the sidebar badge and the drawer at once.
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
        if (body.query.includes('GetApprovalDialogs')) {
          return ok({
            dialogs: {
              edges: server.dialogs.map(node => ({ node })),
              pageInfo: { hasNextPage: false, endCursor: null },
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
        if (body.query.includes('GetBoardColumnTickets')) {
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
          server.resolved.push(body.variables?.input as unknown as { id: string; approve: boolean });
          return ok({ resolveApprovalRequest: { userErrors: [] } });
        }
        throw new Error(`unexpected request: ${body.query}`);
      }),
    },
  };
});
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

async function renderPage(notifications: Notification[] = []) {
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

/** The section headings (the page title is the title block's own). */
const headings = () => [...container.querySelectorAll('section h2')].map(heading => heading.textContent);
/** The cards: the sections' own list items (a card's command section has lists of its own). */
const cards = () => [...container.querySelectorAll('section > ul > li')];
const cardTitled = (title: string) => cards().find(item => item.textContent?.includes(title)) ?? null;
const buttonIn = (element: Element | null, label: string) =>
  [...(element?.querySelectorAll('button') ?? [])].find(button => button.textContent === label) ?? null;

describe('ApprovalsView', () => {
  it('lists every request once and the tickets still waiting on a technician', async () => {
    server.dialogs = [
      mingoChat('d-1', 'ar-1', '2026-10-16T10:00:00Z'),
      mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z'),
    ];
    server.tickets = [techTicket('t-5', 'ar-t5'), techTicket('t-6', 'ar-2')];
    await renderPage([approvalNotification]);

    expect(headings()).toEqual(['Approval requests · 2', 'Tickets waiting for a technician · 1']);
    expect(container.textContent).toContain('2 pending');
    // The notification's card, under its chat's name; the chat behind it is not a second card.
    expect(cardTitled('Chat d-1')).not.toBeNull();
    expect(cards()).toHaveLength(3);
    expect(cardTitled('LAPTOP-7 · Acme')?.textContent).toContain('1152: Customer Service Request');
    const boardLink = [...container.querySelectorAll('a')].find(
      link => link.textContent === 'Tech Required on the board',
    );
    expect(boardLink?.getAttribute('href')).toBe(routes.tickets.filtered({ status: ['s-tech'], viewMode: 'board' }));
    expect(badge()).toBe(3);
  });

  it('has no tickets section, and asks the chat service nothing, outside SaaS', async () => {
    server.saas = false;
    server.dialogs = [mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z')];
    server.tickets = [techTicket('t-5', 'ar-t5')];
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.post).mockClear();
    await renderPage([approvalNotification]);

    expect(headings()).toEqual(['Approval requests · 1']);
    expect(container.textContent).not.toContain('Tickets waiting for a technician');
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(badge()).toBe(1);
  });

  it('opens the ticket, or the chat through the dialog-open seam, from the card title', async () => {
    server.dialogs = [mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z')];
    server.tickets = [techTicket('t-5', 'ar-t5')];
    await renderPage();

    const ticketLink = cardTitled('1152: Customer Service Request')?.querySelector('a');
    expect(ticketLink?.getAttribute('href')).toBe(routes.tickets.dialog('t-5'));

    const chatLink = cardTitled('Chat d-2')?.querySelector('a');
    expect(chatLink?.getAttribute('href')).toBe(routes.mingo.chat('d-2'));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      chatLink?.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(openMingoDialog).toHaveBeenCalledWith('d-2', { navigate: push });
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
    expect(container.textContent).toContain('1 pending');
    expect(badge()).toBe(2);
    // The drawer's tile is completed, as the drawer's own decision completes it.
    expect(markRead).toHaveBeenCalledWith('n-1');

    // Rejected in the chat (any surface records it through the same mutation).
    act(() => noteApprovalDecision('ar-2', false));
    expect(cardTitled('Chat d-2')).toBeNull();
    expect(badge()).toBe(1);
  });

  it('pages only the section it belongs to, and says how far an empty one looked', async () => {
    server.dialogs = [mingoChat('d-2', 'ar-2', '2026-10-16T09:00:00Z')];
    // The lane's first page holds a ticket with no approval; the next one holds one.
    server.tickets = [{ ...techTicket('t-4', 'unused'), pendingApproval: null }];
    server.olderTickets = [techTicket('t-5', 'ar-t5')];
    await renderPage();

    const [requestsSection, ticketsSection] = [...container.querySelectorAll('section')].filter(section =>
      section.querySelector('h2'),
    );
    // Nothing more to load for the requests: no paging control there.
    expect(buttonIn(requestsSection, 'Show more')).toBeNull();
    expect(ticketsSection.textContent).toContain('No approvals in the latest 1 Tech Required ticket.');
    expect(ticketsSection.textContent).not.toContain("No tickets are waiting for a technician's approval.");
    expect(buttonIn(ticketsSection, 'Show more')).toBeNull();

    await act(async () => {
      buttonIn(ticketsSection, 'Check older tickets')?.click();
    });
    await settle();

    expect(cardTitled('LAPTOP-7 · Acme')).not.toBeNull();
    expect(buttonIn(ticketsSection, 'Check older tickets')).toBeNull();
    expect(buttonIn(ticketsSection, 'Show more')).toBeNull();
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
