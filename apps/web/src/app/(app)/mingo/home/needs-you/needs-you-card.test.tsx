/**
 * The "Needs you" card on Mingo's home, over the real gates (app mode + the flags store)
 * and stand-in sources: which sources run in OSS / SaaS with each flag on, off or
 * unanswered; the loading state; the card gone when nothing needs the user; a failed
 * source; the rows' links and the footer.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { NeedsYouCard, NeedsYouPanel } from './needs-you-card';
import {
  NEEDS_YOU_SKELETON_ROWS,
  type NeedsYouRow,
  type NeedsYouSource,
  type ReportSource,
  type SourceReport,
} from './needs-you-rows';

const env = vi.hoisted(() => ({
  saas: true,
  /** Sources mounted in the last render. */
  mounted: new Set<string>(),
  reports: {} as Partial<Record<string, SourceReport>>,
  /** Thrown by the tenants source instead of reporting. */
  tenantsFail: false,
  ticketGates: [] as string[],
  ticketStats: { isLoading: false, aiAssistance: 3 as number | null, techRequired: 2 as number | null },
}));

vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => env.saas,
}));

/**
 * A stand-in Relay source: reports its fixture once mounted, like the real ones. A
 * function declaration, so the hoisted `vi.mock` factories below can reach it.
 */
function fakeSource(name: string, sources: readonly NeedsYouSource[]) {
  return function FakeSource({ onReport }: { onReport: ReportSource }) {
    env.mounted.add(name);
    if (name === 'tenants' && env.tenantsFail) throw new Error('directory service down');
    useEffect(() => {
      for (const source of sources) {
        const report = env.reports[source];
        if (report) onReport(source, report);
      }
    }, [onReport]);
    return null;
  };
}

vi.mock('./needs-you-approvals-source', () => ({ NeedsYouApprovalsSource: fakeSource('approvals', ['approvals']) }));
vi.mock('./needs-you-insights-source', () => ({
  NeedsYouInsightsSource: fakeSource('insights', ['incidents', 'disk']),
}));
vi.mock('./needs-you-tenants-source', () => ({ NeedsYouTenantsSource: fakeSource('tenants', ['tenants']) }));
vi.mock('./needs-you-software-source', () => ({ NeedsYouSoftwareSource: fakeSource('software', ['software']) }));
vi.mock('./use-escalated-tickets-report', () => ({
  useEscalatedTicketsReport: (gate: string): SourceReport => {
    env.ticketGates.push(gate);
    return gate === 'on' ? (env.reports.tickets ?? { status: 'loading' }) : { status: 'loading' };
  },
}));
vi.mock('@/app/(app)/dashboard/hooks/use-dashboard-stats', () => ({
  useTicketsOverview: () => env.ticketStats,
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function row(source: NeedsYouSource, id: string, href: string, reason = 'Reason'): NeedsYouRow {
  return {
    key: `${source}:${id}`,
    entity: source === 'disk' ? 'device' : 'incident',
    deviceType: 'laptop',
    name: `${source} ${id}`,
    detail: `detail ${id}`,
    reason,
    tone: 'error',
    href,
    subjects: [`${source}:${id}`],
  };
}

const ready = (...rows: NeedsYouRow[]): SourceReport => ({ status: 'ready', rows });

/** Every source answered empty: nothing needs the user. */
function emptyReports(): Partial<Record<string, SourceReport>> {
  return {
    approvals: ready(),
    incidents: { status: 'ready', rows: [], count: 0 },
    disk: ready(),
    tickets: ready(),
    tenants: ready(),
    software: ready(),
  };
}

function setFlags(flags: Record<string, boolean> | 'unanswered') {
  if (flags === 'unanswered') useFeatureFlagsStore.setState({ flags: {}, isLoaded: false });
  else useFeatureFlagsStore.setState({ flags, isLoaded: true });
}

const ALL_FLAGS = { insights: true, 'tenant-management': true, 'software-management': true };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  env.saas = true;
  env.mounted = new Set();
  env.reports = emptyReports();
  env.tenantsFail = false;
  env.ticketGates = [];
  env.ticketStats = { isLoading: false, aiAssistance: 3, techRequired: 2 };
  setFlags(ALL_FLAGS);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render() {
  await act(async () => {
    root.render(<NeedsYouCard />);
  });
}

const caption = () => Array.from(container.querySelectorAll('p')).find(p => p.textContent === 'Needs you');
const isLoading = () => container.querySelector('[aria-busy="true"]') !== null;
const links = () => Array.from(container.querySelectorAll('a')).map(a => [a.textContent, a.getAttribute('href')]);

describe('NeedsYouCard gating', () => {
  it('SaaS with every flag on runs every source', async () => {
    await render();
    expect([...env.mounted].sort()).toEqual(['approvals', 'insights', 'software', 'tenants']);
    expect(env.ticketGates.at(-1)).toBe('on');
  });

  it('OSS runs no ticket or incident source — the flags do not matter there', async () => {
    env.saas = false;
    await render();
    expect([...env.mounted].sort()).toEqual(['approvals', 'software', 'tenants']);
    expect(env.ticketGates.at(-1)).toBe('off');
  });

  it('a flag that is off keeps its source from running', async () => {
    setFlags({ insights: false, 'tenant-management': false, 'software-management': true });
    await render();
    expect([...env.mounted].sort()).toEqual(['approvals', 'software']);
  });

  it('unanswered flags show the loading state and run nothing behind them', async () => {
    setFlags('unanswered');
    env.reports.approvals = ready(row('approvals', '1', routes.tickets.dialog('t-1')));
    await render();
    expect([...env.mounted]).toEqual(['approvals']);
    expect(isLoading()).toBe(true);
    expect(caption()).toBeDefined();
    expect(links()).toEqual([]);
  });

  it('loads until every open source answered', async () => {
    delete env.reports.software;
    await render();
    expect(isLoading()).toBe(true);
  });

  it('loads while the ticket counts of the footer are loading', async () => {
    env.ticketStats = { isLoading: true, aiAssistance: null, techRequired: null };
    env.reports.approvals = ready(row('approvals', '1', routes.tickets.dialog('t-1')));
    await render();
    expect(isLoading()).toBe(true);
  });
});

describe('NeedsYouCard loading', () => {
  const loadingRows = () => container.querySelectorAll('[data-loading-item]');

  it('draws the set number of rows however many sources are open, under its real caption', async () => {
    delete env.reports.software;
    await render();
    expect(loadingRows()).toHaveLength(NEEDS_YOU_SKELETON_ROWS);
    expect(caption()).toBeDefined();

    setFlags('unanswered');
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(loadingRows()).toHaveLength(NEEDS_YOU_SKELETON_ROWS);
  });

  it('is the panel itself, which the shell can hold with no source behind it', async () => {
    await act(async () => {
      root.render(<NeedsYouPanel loading />);
    });
    expect(env.mounted.size).toBe(0);
    expect(isLoading()).toBe(true);
    expect(caption()).toBeDefined();
    expect(loadingRows()).toHaveLength(NEEDS_YOU_SKELETON_ROWS);
  });
});

describe('NeedsYouCard content', () => {
  it('renders nothing when nothing needs the user', async () => {
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('lists the rows in source order, each linking to its entity page', async () => {
    env.reports.disk = ready(row('disk', 'm-1', routes.devices.details('m-1'), 'Low disk space'));
    env.reports.approvals = ready(row('approvals', 'a-1', routes.tickets.dialog('t-1'), 'Needs approval'));
    env.reports.tenants = ready(row('tenants', 'c-1', routes.cloudTenantManagement.details('c-1'), 'Sync failed'));
    await render();
    expect(isLoading()).toBe(false);
    expect(caption()).toBeDefined();
    expect(links()).toEqual([
      ['approvals a-1', routes.tickets.dialog('t-1')],
      ['tenants c-1', routes.cloudTenantManagement.details('c-1')],
      ['disk m-1', routes.devices.details('m-1')],
    ]);
    expect(container.textContent).toContain('Needs approval');
    expect(container.textContent).toContain('Sync failed');
  });

  it('prints the footer counts, without the gated-off parts', async () => {
    env.reports.incidents = { status: 'ready', rows: [row('incidents', 'i-1', '/x')], count: 4 };
    await render();
    expect(container.textContent).toContain('3 tickets handled by AI · 2 need a technician · 4 new incidents');

    env.saas = false;
    env.reports.software = ready(row('software', 's-1', routes.software.action('s-1')));
    await render();
    expect(container.textContent).not.toContain('handled by AI');
    expect(container.textContent).not.toContain('new incidents');
  });

  it('a failed source keeps the card up with a retry, beside the rows that loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    env.tenantsFail = true;
    delete env.reports.tenants;
    env.reports.software = ready(row('software', 's-1', routes.software.action('s-1')));
    await render();
    expect(isLoading()).toBe(false);
    expect(links()).toEqual([['software s-1', routes.software.action('s-1')]]);
    expect(container.textContent).toContain("Couldn't load everything that needs you.");
    expect(container.querySelector('button[aria-label^="Retry"]')).not.toBeNull();
  });
});
