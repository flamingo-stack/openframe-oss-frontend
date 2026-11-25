/**
 * The assignments panel's article and ticket tables in their two layouts.
 *
 * Card rows (the app's table flag off) are locked as markup: those snapshots were recorded BEFORE the tables learned
 * the grid layout, and that change left them untouched. Update one only for a change that means to alter the card
 * rows.
 *
 * The grid (the flag on): the lib's grid table at its natural height (the panel is a section of a longer page), with
 * the gear of its saved column settings, the open action as an action column and one line in every cell.
 */

import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  fixedViewport,
  gridBodyText,
  gridColumns,
  gridRoot,
  loadingHeaderCells,
  metaRow,
  saveHiddenColumn,
  settingsGear,
  setTableGridFlag,
  stubTableBrowserApis,
  twoLineCells,
} from '@/app/components/shared/table-grid-flag.fixtures';
import { type AssignedArticle, KnowledgeBaseAssignedTable } from './knowledge-base-assigned-table';
import { TicketsAssignedTable } from './tickets-assigned-table';

// A time of day is printed in the viewer's zone: the snapshots are the same on every machine.
vi.hoisted(() => {
  process.env.TZ = 'UTC';
});

// The first-assignment picker of an unassigned row reads the assignee list and holds a mutation.
vi.mock('@/app/(app)/tickets/components/table-assignee-cell', () => ({
  UnassignedTicketCell: ({ interactive }: { interactive: boolean }) => (
    <span data-unassigned={interactive ? 'pick' : 'label'}>Unassigned</span>
  ),
}));
vi.mock('@/app/hooks/use-user-status-map', () => ({ useUserStatusMap: () => ({ isUserDeleted: () => false }) }));
// Something under the shared columns reaches a Relay-tagged query; the tag needs the Babel transform vitest does not
// run, and nothing here executes it.
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/scripts/details',
  useSearchParams: () => new URLSearchParams(),
}));

const NOW = new Date('2026-01-15T12:00:00Z');

const ARTICLES = [
  {
    id: 'kb-2',
    type: 'ARTICLE',
    name: 'Reset a user password',
    status: 'PUBLISHED',
    summary: 'Steps for the service desk when a user is locked out of their account',
    createdAt: '2026-01-12T14:05:00Z',
  },
  { id: 'kb-3', type: 'ARTICLE', name: 'VPN setup', status: 'DRAFT', summary: null, createdAt: null },
] as unknown as AssignedArticle[];

const TICKETS: Dialog[] = [
  {
    id: 't-1',
    title: 'Printer on the second floor prints blank pages',
    ticketNumber: 3891,
    createdAt: '2026-01-15T11:55:00Z',
    owner: { type: 'CLIENT', machineId: 'm-1', machine: { id: 'm-1', machineId: 'm-1', hostname: 'front-desk-pc' } },
    organizationName: 'Acme Corp',
    assignedTo: 'user-1',
    assignedName: 'Maya Chen',
    statusId: 's-1',
    statusName: 'In progress',
    statusColor: 'blue',
    statusKind: 'IN_PROGRESS',
  },
  {
    id: 't-2',
    title: 'VPN drops every hour',
    ticketNumber: 3890,
    createdAt: '2026-01-14T09:00:00Z',
    owner: { type: 'ADMIN' },
    statusId: 's-2',
    statusName: 'New',
    statusColor: 'grey',
    statusKind: 'NEW',
  },
];

beforeAll(stubTableBrowserApis);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

describe('assignments tables, card rows (the flag off)', () => {
  it('assigned articles', () => {
    setTableGridFlag('off');
    const { container } = mount(<KnowledgeBaseAssignedTable articles={ARTICLES} />);
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('assigned articles, loading', () => {
    setTableGridFlag('off');
    const { container } = mount(<KnowledgeBaseAssignedTable articles={[]} isLoading />);
    expect(container).toMatchSnapshot();
  });

  it('assigned tickets', () => {
    setTableGridFlag('off');
    const { container } = mount(<TicketsAssignedTable tickets={TICKETS} />);
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('assigned tickets, loading', () => {
    setTableGridFlag('off');
    const { container } = mount(<TicketsAssignedTable tickets={[]} isLoading />);
    expect(container).toMatchSnapshot();
  });
});

/** The open-in-new-tab buttons of a grid table's rows. */
const openButtons = (scope: ParentNode) =>
  scope.querySelectorAll('[data-grid-body] button[aria-label="Open in new tab"]');

describe('assignments tables, the grid (the flag on)', () => {
  it('assigned articles: one line in every cell, the count above the table, the panel’s natural height', () => {
    setTableGridFlag('on');
    const { container } = mount(<KnowledgeBaseAssignedTable articles={ARTICLES} />);

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['name', 'created']);
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    expect(metaRow(container)?.textContent).toContain('2');
    expect(gridBodyText(container)).toContain('Reset a user password');
    expect(gridBodyText(container)).toContain('Steps for the service desk');
    expect(gridBodyText(container)).toContain('DRAFT');
    expect(openButtons(container)).toHaveLength(2);
    // The search above the table stays.
    expect(container.querySelector('input[placeholder="Search for Knowledge Article"]')).not.toBeNull();
  });

  it('assigned articles: names no column while the assignments are read', () => {
    setTableGridFlag('on');
    const { container } = mount(<KnowledgeBaseAssignedTable articles={[]} isLoading />);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual([]);
    expect(loadingHeaderCells(container).length).toBeGreaterThan(0);
  });

  it('assigned tickets: the shared ticket columns in the grid, at the panel’s natural height', () => {
    setTableGridFlag('on');
    const { container } = mount(<TicketsAssignedTable tickets={TICKETS} />);

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['title', 'source', 'assignee', 'status']);
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    expect(gridBodyText(container)).toContain('3891 • 5 min ago');
    expect(openButtons(container)).toHaveLength(2);
  });

  it('keeps a column layout per table', () => {
    setTableGridFlag('on');
    saveHiddenColumn('assignments-articles', 'created');
    saveHiddenColumn('assignments-tickets', 'source');
    expect(gridColumns(mount(<KnowledgeBaseAssignedTable articles={ARTICLES} />).container)).toEqual(['name']);
    expect(gridColumns(mount(<TicketsAssignedTable tickets={TICKETS} />).container)).toEqual([
      'title',
      'assignee',
      'status',
    ]);
  });

  it.each([
    ['assigned articles', () => <KnowledgeBaseAssignedTable articles={ARTICLES} />, 'Reset a user password'],
    ['assigned tickets', () => <TicketsAssignedTable tickets={TICKETS} />, 'VPN drops every hour'],
  ])('%s: loading rows while the flag is read, then the grid, never card rows first', (_name, table, row) => {
    setTableGridFlag('loading');
    const { container } = mount(table());
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain(row);

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toContain(row);
  });
});
