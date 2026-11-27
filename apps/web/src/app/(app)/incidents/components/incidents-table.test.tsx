/**
 * The incidents table draws the grid table only where the server serves `data-table-grid` as on: on the Incidents page
 * (where it fills the page's height) and in a device's Incidents tab (where the page scrolls). Where the flag is off,
 * or has no value, it keeps its card rows; while the flags are out it reads nothing and draws card loading rows.
 *
 * The table owns its columns, so it is drawn for real over one incident.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({ queries: 0 }));

/** One incident, as the table's query selects it. */
const NODE = vi.hoisted(() => ({
  id: 'insight-1',
  title: 'Disk almost full',
  type: 'DISK_SPACE',
  severity: 'HIGH',
  status: 'ACKNOWLEDGED',
  snoozedUntil: null,
  detectedAt: '2026-11-18T10:15:00Z',
  machineId: 'm-1',
  machine: { hostname: 'reception-01', displayName: null, nickname: null, type: 'DESKTOP' },
  organizationId: 'org-1',
  organization: { name: 'Acme Logistics' },
  assigneeId: null,
  assignee: null,
  unreadNotificationCount: 0,
}));

// One answer, one router and one address for the whole run: the hooks that read them compare by identity.
vi.mock('react-relay', async importOriginal => {
  const facet = (value: string) => [{ value, label: value, count: 1 }];
  const query = {
    // One page: the only one.
    insights: {
      edges: [{ node: NODE }],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: 'c-1', endCursor: 'c-1' },
    },
    insightFilters: {
      types: facet('DISK_SPACE'),
      severities: facet('HIGH'),
      statuses: facet('ACKNOWLEDGED'),
      organizationIds: [{ value: 'org-1', label: 'Acme Logistics', count: 1 }],
      assigneeIds: [],
      filteredCount: 1,
    },
    insightStatusTransitions: [{ from: 'ACKNOWLEDGED', to: ['RESOLVED'] }],
  };
  const environment = {};
  const commit = () => undefined;
  return {
    ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
    graphql: () => ({}),
    useLazyLoadQuery: () => {
      env.queries += 1;
      return query;
    },
    // An `@inline` fragment's data is what the operation selected: the stand-in answers above are it already.
    readInlineData: (_fragment: unknown, ref: unknown) => ref,
    useMutation: () => [commit, false],
    useRelayEnvironment: () => environment,
  };
});
vi.mock('next/navigation', () => {
  const router = { push: () => undefined, replace: () => undefined };
  const searchParams = new URLSearchParams();
  return { useRouter: () => router, usePathname: () => '/incidents', useSearchParams: () => searchParams };
});
// The auto-refresh is off by default and waits for the subscription's answer: no guard is mounted here.
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => false }));
// The agents' marks are drawn from their server identities, provided at the app's root: a stand-in here.
vi.mock('@flamingo-stack/openframe-frontend-core/components', async importOriginal => ({
  ...(await importOriginal<object>()),
  AgentMark: () => <span data-mingo-mark />,
}));
// What a row's buttons do is not this test's: stand-ins with stable answers.
vi.mock('../hooks/use-fix-with-mingo', () => {
  const controls = {};
  const action = { label: 'Fix with Mingo', onClick: () => undefined, disabled: false, loading: false };
  return { useFixWithMingo: () => controls, mingoActionFor: () => action };
});
vi.mock('../hooks/use-incident-dialogs', () => {
  const sessions = {};
  return { useLatestIncidentDialogs: () => sessions };
});
vi.mock('../hooks/use-incident-transitions', () => {
  const answer = {
    transition: () => undefined,
    snoozeTarget: null,
    cancelSnooze: () => undefined,
    confirmSnooze: () => undefined,
    isMutating: false,
    isSnoozing: false,
  };
  return { useIncidentTransitions: () => answer };
});
vi.mock('./incident-assignee', () => ({ IncidentAssignee: () => <span>Unassigned</span> }));
vi.mock('./snooze-incident-modal', () => ({ SnoozeIncidentModal: () => null }));

import { DeviceIncidentsTable, IncidentsTable } from './incidents-table';

let container: HTMLDivElement;
let root: Root;

const flag = (enabled: boolean) => useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled }]);

function render(element: React.ReactElement) {
  act(() => root.render(element));
  return container.innerHTML;
}

/** The button with this accessible name, as drawn now. */
function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === name);
  if (!found) throw new Error(`no button "${name}"`);
  return found;
}

/** The grid's header and body, as markup. */
function gridParts(markup: string): { header: string; body: string } {
  const bodyStart = markup.indexOf('data-grid-body');
  return { header: markup.slice(markup.indexOf('data-grid-header="'), bodyStart), body: markup.slice(bodyStart) };
}

/** The ids of the grid's data columns, in header order (action columns carry no id). */
const gridColumns = (markup: string) =>
  [...gridParts(markup).header.matchAll(/data-grid-col="([^"]+)"/g)].map(match => match[1] ?? '');

/** The stated width of the grid's column at `index`, in px. */
const columnWidth = (markup: string, index: number) =>
  Number(new RegExp(`--dtc${index}-w: (\\d+)px`).exec(markup)?.[1]);

/** The text of the first row's data cell in `column`: from its tag to the next cell. */
function cellText(markup: string, column: string): string {
  const { body } = gridParts(markup);
  const from = body.indexOf('>', body.indexOf(`data-grid-col="${column}"`)) + 1;
  const ends = ['data-grid-col="', 'data-no-row-click'].map(next => body.indexOf(next, from)).filter(at => at !== -1);
  return body
    .slice(from, ends.length ? Math.min(...ends) : body.length)
    .replace(/<[^>]*$/, '')
    .replace(/<[^>]+>/g, '');
}

/**
 * A card table's markup: no grid table, and no grid header or meta row (the one row above the card rows holds the
 * range, the pager and the auto-refresh picker, whose divider is the only `data-grid-` mark a card table carries).
 */
const isCardTable = (markup: string) =>
  !['data-grid-root', 'data-grid-header', 'data-grid-meta=', 'data-grid-col'].some(mark => markup.includes(mark));

/** How many loading rows the table draws. */
const loadingRows = (markup: string) => markup.split('data-loading-item').length - 1;

/** jsdom has no `ResizeObserver`, and the list measures its sticky toolbar with one: an observer that never fires. */
class IdleResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const NO_INCIDENTS = <div data-no-incidents />;

describe('the incidents table and the table flag', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', IdleResizeObserver));
  afterAll(() => vi.unstubAllGlobals());

  beforeEach(() => {
    env.queries = 0;
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  describe('the Incidents page', () => {
    it('draws the grid table where the flag is on: it fills the page, with the gear in its header', () => {
      flag(true);
      const markup = render(<IncidentsTable tab="current" />);
      expect(markup).toContain('data-grid-root');
      expect(markup).toContain('data-grid-settings-cell');
      expect(markup).toContain('--data-table-max-height');
      expect(markup.indexOf('data-grid-meta')).toBeLessThan(markup.indexOf('data-grid-header'));
      expect(gridColumns(markup)).toEqual(['type', 'organizationId', 'severity', 'status', 'assigneeId']);
      // Incident 400, Device 320, Severity 140, Status 240, Assigned 240, then the menu, Mingo and open, 56 each.
      expect([0, 1, 2, 3, 4, 5, 6, 7].map(index => columnWidth(markup, index))).toEqual([
        400, 320, 140, 240, 240, 56, 56, 56,
      ]);
      expect(container.textContent).toContain('1 result');
    });

    it('puts a card row’s two lines on one: the title with its type, the device with its customer', () => {
      flag(true);
      const markup = render(<IncidentsTable tab="current" />);
      expect(cellText(markup, 'type')).toMatch(/^Disk almost full.+/);
      expect(cellText(markup, 'organizationId')).toBe('reception-01Acme Logistics');
      expect(cellText(markup, 'severity')).toBe('HIGH');
      // The status tag, then the time a card row prints under it.
      expect(cellText(markup, 'status')).toMatch(/^ACKNOWLEDGED.+/);
    });

    it('reads the viewer’s saved column layout under its own key', () => {
      window.localStorage.setItem(
        'ods-data-table:incidents',
        JSON.stringify({ version: 1, order: [], hidden: ['severity'], sizing: {} }),
      );
      flag(true);
      expect(gridColumns(render(<IncidentsTable tab="current" />))).toEqual([
        'type',
        'organizationId',
        'status',
        'assigneeId',
      ]);
    });

    it('draws the row actions as bare buttons in action columns', () => {
      flag(true);
      render(<IncidentsTable tab="current" />);
      for (const name of ['More actions', 'Fix with Mingo', 'Open in new tab']) {
        expect(button(name).className).toContain('size-10');
        expect(button(name).className).not.toContain('bg-ods-card');
      }
    });

    it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
      flag(false);
      expect(isCardTable(render(<IncidentsTable tab="current" />))).toBe(true);
      expect(container.textContent).toContain('Disk almost full');
      // The range over the facets' total, in the row above the card rows.
      expect(container.querySelector('[data-table-meta]')?.textContent).toContain('1–1 of 1 result');
      for (const name of ['Fix with Mingo', 'Open in new tab']) {
        expect(button(name).className).toContain('bg-ods-card');
      }

      act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]));
      expect(isCardTable(container.innerHTML)).toBe(true);
    });

    it('reads nothing and draws card loading rows while the flags are out, then the grid with its rows', () => {
      const out = render(<IncidentsTable tab="current" />);
      expect(out).not.toContain('data-grid-');
      expect(loadingRows(out)).toBeGreaterThan(0);
      expect(container.textContent).not.toContain('Disk almost full');
      expect(env.queries).toBe(0);

      act(() => {
        flag(true);
      });
      expect(container.innerHTML).toContain('data-grid-root');
      expect(container.textContent).toContain('Disk almost full');
      expect(env.queries).toBeGreaterThan(0);
    });
  });

  describe("a device's Incidents tab", () => {
    it('draws the grid table with no Device column and no height of its own, under its own key', () => {
      window.localStorage.setItem(
        'ods-data-table:device-incidents',
        JSON.stringify({ version: 1, order: [], hidden: ['severity'], sizing: {} }),
      );
      flag(true);
      const markup = render(<DeviceIncidentsTable machineId="m-1" emptyState={NO_INCIDENTS} />);
      expect(markup).toContain('data-grid-root');
      expect(markup).not.toContain('--data-table-max-height');
      // Every row names the same machine: no Device column. The viewer hid Severity in this table only.
      expect(gridColumns(markup)).toEqual(['type', 'status', 'assigneeId']);
    });

    it('keeps card rows where the flag is off, and a loading scope while the flags are out', () => {
      flag(false);
      expect(isCardTable(render(<DeviceIncidentsTable machineId="m-1" emptyState={NO_INCIDENTS} />))).toBe(true);
      expect(container.textContent).toContain('Disk almost full');

      act(() => useFeatureFlagsStore.getState().reset());
      expect(isCardTable(container.innerHTML)).toBe(true);
      expect(loadingRows(container.innerHTML)).toBeGreaterThan(0);
      expect(container.textContent).not.toContain('Disk almost full');
    });
  });
});
