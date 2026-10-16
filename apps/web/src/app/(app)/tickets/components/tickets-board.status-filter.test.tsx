/**
 * The board applies `?status=` (the status ids the table filters by): only the named
 * lanes render, subscribe and load, and the filter shows as an applied control — inline
 * and in the mobile modal — that clears it. With no filter (or one naming no lane) the
 * board is the board it always was: every lane, no status control.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketsBoard } from './tickets-board';

const STATUSES = [
  { id: 's-ai', name: 'AI Handling', color: '#0ff', position: 'a', kind: 'AI_ASSISTANCE', isSystem: true },
  { id: 's-tech', name: 'Tech Required', color: '#f80', position: 'b', kind: 'TECH_REQUIRED', isSystem: true },
  { id: 's-waiting', name: 'Waiting', color: '#888', position: 'c', kind: 'CUSTOM', isSystem: false },
  { id: 's-resolved', name: 'Resolved', color: '#0f0', position: 'd', kind: 'RESOLVED', isSystem: true },
  { id: 's-archived', name: 'Archived', color: '#000', position: 'e', kind: 'ARCHIVED', isSystem: true },
].map(status => ({ ...status, staleAfterMinutes: 120 }));

const probe = vi.hoisted(() => ({
  subscribed: [] as string[],
  modalStatus: undefined as { value: string[] } | undefined,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', async importOriginal => ({
  ...(await importOriginal<object>()),
  Board: ({ columns }: { columns: Array<{ id: string; label: string }> }) => (
    <ul>
      {columns.map(column => (
        <li key={column.id} data-lane={column.id}>
          {column.label}
        </li>
      ))}
    </ul>
  ),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
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
      probe.subscribed.push(statusId);
      // One ticket on the board, so an unfiltered board is not the "no tickets yet" state.
      const tickets =
        statusId === 's-tech' ? [{ id: 't-1', title: 'Printer down', createdAt: '2026-10-01T09:00:00Z' }] : [];
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
vi.mock('./tickets-empty-state', () => ({ TicketsEmptyState: () => <p>no tickets yet</p> }));
vi.mock('./tickets-filter-modal', () => ({
  TicketsFilterModal: ({ status }: { status?: { value: string[] } }) => {
    probe.modalStatus = status;
    return null;
  },
}));
vi.mock('./status-autocomplete', () => ({
  StatusFilter: ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => (
    <div data-status-filter={value.join(',')}>
      <button type="button" onClick={() => onChange([])}>
        clear status
      </button>
    </div>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  probe.subscribed = [];
  probe.modalStatus = undefined;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderBoard(statusIds: string[] | undefined, onStatusIdsChange = vi.fn()) {
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <TicketsBoard statusIds={statusIds} onStatusIdsChange={onStatusIdsChange} search="" onSearchChange={() => {}} />
      </QueryClientProvider>,
    ),
  );
  return onStatusIdsChange;
}

const lanes = () => Array.from(container.querySelectorAll('[data-lane]')).map(li => li.getAttribute('data-lane'));
const statusFilter = () => container.querySelector('[data-status-filter]');

describe('TicketsBoard ?status=', () => {
  it('shows every lane and no status control without a filter', () => {
    renderBoard(undefined);
    expect(lanes()).toEqual(['s-ai', 's-tech', 's-waiting', 's-resolved']);
    expect(probe.subscribed).toEqual(['s-ai', 's-tech', 's-waiting', 's-resolved']);
    expect(statusFilter()).toBeNull();
    expect(probe.modalStatus).toBeUndefined();
  });

  it('shows only the filtered lanes, loads only those, and shows the applied filter', () => {
    renderBoard(['s-waiting', 's-ai']);
    expect(lanes()).toEqual(['s-ai', 's-waiting']);
    expect(probe.subscribed).toEqual(['s-ai', 's-waiting']);
    expect(statusFilter()?.getAttribute('data-status-filter')).toBe('s-ai,s-waiting');
    expect(probe.modalStatus?.value).toEqual(['s-ai', 's-waiting']);
    // The board's empty state is for "no tickets at all", not for a filter.
    expect(container.textContent).not.toContain('no tickets yet');
  });

  it('clears the filter from its control', () => {
    const onStatusIdsChange = renderBoard(['s-ai']);
    const clear = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'clear status');
    act(() => clear?.click());
    expect(onStatusIdsChange).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('ignores a filter that names no lane', () => {
    renderBoard(['deleted-status']);
    expect(lanes()).toEqual(['s-ai', 's-tech', 's-waiting', 's-resolved']);
    expect(statusFilter()).toBeNull();
  });
});
