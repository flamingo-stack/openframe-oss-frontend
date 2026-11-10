/**
 * A board card's assignee avatar is the image's gateway URL: the API serves `/images/...` only under the tenant
 * host's `/api`, and the lib's card draws `avatarUrl` as it is given (and so does the assign picker in the slot).
 */

import type { BoardColumnDef } from '@flamingo-stack/openframe-frontend-core/components/features';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketsBoard } from './tickets-board';

const STATUSES = [
  { id: 's-tech', name: 'Tech Required', color: '#f80', position: 'b', kind: 'TECH_REQUIRED', isSystem: true },
].map(status => ({ ...status, staleAfterMinutes: 120 }));

const probe = vi.hoisted(() => ({ columns: [] as BoardColumnDef[] }));

vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.example' } }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/features', async importOriginal => ({
  ...(await importOriginal<object>()),
  Board: ({ columns }: { columns: BoardColumnDef[] }) => {
    probe.columns = columns;
    return null;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// The shared barrel re-exports the devices panel, whose Relay query the test transform does not compile.
vi.mock('@/app/components/shared', () => ({ NO_ITEMS: [] }));
vi.mock('../statuses/hooks/use-ticket-statuses-query', () => ({
  useTicketStatusesQuery: () => ({ data: { snapshot: STATUSES }, isLoading: false, error: null }),
}));
vi.mock('../hooks/use-ticket-status-transition-rules', () => ({ useTicketStatusTransitionRules: () => ({}) }));
vi.mock('../hooks/use-move-ticket', () => ({
  useMoveTicket: () => ({ mutate: vi.fn() }),
  useMovingTicketIds: () => new Set(),
}));
vi.mock('@/app/hooks/use-user-status-map', () => ({ useUserStatusMap: () => ({ isUserDeleted: () => false }) }));
vi.mock('../hooks/use-approval-requests', () => ({
  useApprovalRequests: () => ({ handleApproveRequest: vi.fn(), handleRejectRequest: vi.fn() }),
}));
vi.mock('../hooks/use-tickets-actions', () => ({
  useTicketsActions: () => ({
    actions: [],
    menuActions: [],
    dialog: null,
    canArchiveResolved: false,
    openArchiveResolvedConfirm: vi.fn(),
  }),
  emphasizeNewTicketAction: (actions: unknown[]) => actions,
}));
vi.mock('./board-column-subscriber', () => ({
  BoardColumnSubscriber: ({
    statusId,
    onUpdate,
  }: {
    statusId: string;
    onUpdate: (statusId: string, update: unknown) => void;
  }) => {
    useEffect(() => {
      const tickets = [
        {
          id: 't-1',
          title: 'Printer down',
          createdAt: '2026-10-01T09:00:00Z',
          assignedTo: 'u-1',
          assignedName: 'Ann Lee',
          assigneeImageUrl: '/images/user/u-1',
          assigneeImageHash: 'h1',
        },
      ];
      onUpdate(statusId, {
        state: { tickets, total: tickets.length, endCursor: null, hasMore: false, isLoadingMore: false },
        isLoading: false,
        error: null,
      });
    }, [statusId, onUpdate]);
    return null;
  },
}));
vi.mock('./board-columns-cache', () => ({ usePlaceholderBoardColumns: () => [], writeCachedBoardColumns: () => {} }));
vi.mock('./organization-filter', () => ({ OrganizationFilter: () => null }));
vi.mock('./assignee-filter', () => ({ AssigneeFilter: () => null }));
vi.mock('./activity-filter', () => ({ ActivityFilter: () => null }));
vi.mock('./ticket-tag-filter', () => ({ TicketTagFilter: () => null }));
vi.mock('./board-assignee-picker', () => ({ BoardAssigneePicker: () => null }));
vi.mock('./take-over-ticket-modal', () => ({ TakeOverTicketModal: () => null }));
vi.mock('./reopen-ticket-modal', () => ({ ReopenTicketModal: () => null }));
vi.mock('./tickets-empty-state', () => ({ TicketsEmptyState: () => null }));
vi.mock('./tickets-filter-modal', () => ({ TicketsFilterModal: () => null }));
vi.mock('./status-autocomplete', () => ({ StatusFilter: () => null }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  probe.columns = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('TicketsBoard assignee avatar', () => {
  it("is the image's absolute gateway URL with its hash", () => {
    act(() =>
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TicketsBoard search="" onSearchChange={() => {}} />
        </QueryClientProvider>,
      ),
    );

    const [ticket] = probe.columns.find(column => column.id === 's-tech')?.tickets ?? [];
    expect(ticket?.assignees?.[0]?.avatarUrl).toBe('https://acme.example/api/images/user/u-1?v=h1');
  });
});
