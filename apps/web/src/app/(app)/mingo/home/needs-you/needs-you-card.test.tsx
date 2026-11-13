/**
 * The "Needs you" block on Mingo's home and the dashboard, over the real gates (app mode + the
 * flags store) and stand-in sources: which sources run in OSS / SaaS with each flag on, off or
 * unanswered; the loading form (three rows and the quick actions, in their loaded boxes); the
 * queue (newest first, three at most, Mingo and open per row, a row the user acted on leaving);
 * the empty state; the quick actions' counts and links; a failed source.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { routes } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { NeedsYouCard, NeedsYouPanel } from './needs-you-card';
import {
  NEEDS_YOU_ROWS,
  needsYouMingoPrompt,
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
  useTechRequiredStatusIds: (gate: string) => (gate === 'on' ? ['tr-1'] : []),
}));
vi.mock('@/app/(app)/dashboard/hooks/use-dashboard-stats', () => ({
  useTicketsOverview: () => env.ticketStats,
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function row(source: NeedsYouSource, id: string, at: number, href = `/${source}/${id}`): NeedsYouRow {
  return {
    key: `${source}:${id}`,
    entity: source === 'disk' ? 'device' : 'incident',
    deviceType: 'laptop',
    name: `${source} ${id}`,
    detail: `detail ${id}`,
    reason: 'Reason',
    tone: 'warning',
    href,
    at,
    subjects: [`${source}:${id}`],
  };
}

const ready = (...rows: NeedsYouRow[]): SourceReport => ({ status: 'ready', rows });

/** Every source answered empty: nothing needs the user. */
function emptyReports(): Partial<Record<string, SourceReport>> {
  return {
    approvals: ready(),
    incidents: { status: 'ready', rows: [], count: 0 },
    disk: { status: 'ready', rows: [], count: 0 },
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
  window.localStorage.clear();
  env.saas = true;
  env.mounted = new Set();
  env.reports = emptyReports();
  env.tenantsFail = false;
  env.ticketGates = [];
  env.ticketStats = { isLoading: false, aiAssistance: 3, techRequired: 2 };
  setFlags(ALL_FLAGS);
  useMingoLauncherStore.setState({ dockMounted: true, dockRequest: null });
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

const caption = () => Array.from(container.querySelectorAll('p')).find(p => p.textContent === 'Needs your attention:');
const isLoading = () => container.querySelector('[aria-busy="true"]') !== null;
const queueBox = () => container.querySelector('[data-testid="needs-you-queue"]');
const queueRows = () => Array.from(queueBox()?.querySelectorAll('li') ?? []);
const rowNames = () => queueRows().map(li => li.querySelector('span.text-h4')?.textContent);
const chips = () =>
  Array.from(container.querySelectorAll('a[aria-label], button[aria-label]'))
    .filter(el => !queueBox()?.contains(el))
    .map(el => [el.textContent, el.getAttribute('href')]);
const control = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`);

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
    env.reports.approvals = ready(row('approvals', '1', 1));
    await render();
    expect([...env.mounted]).toEqual(['approvals']);
    expect(isLoading()).toBe(true);
    expect(caption()).toBeDefined();
    expect(control('Open approvals 1')).toBeNull();
  });

  it('loads until every open source answered', async () => {
    delete env.reports.software;
    await render();
    expect(isLoading()).toBe(true);
  });

  it('loads while the Tickets count is loading', async () => {
    env.ticketStats = { isLoading: true, aiAssistance: null, techRequired: null };
    env.reports.approvals = ready(row('approvals', '1', 1));
    await render();
    expect(isLoading()).toBe(true);
  });
});

describe('NeedsYouCard loading form', () => {
  const loadingChips = () =>
    Array.from(container.querySelectorAll('[data-loading-item]')).filter(el => !queueBox()?.contains(el));

  it('three rows in the queue box under the real caption, and a quick action per open category', async () => {
    delete env.reports.software;
    await render();
    expect(caption()).toBeDefined();
    expect(queueRows()).toHaveLength(NEEDS_YOU_ROWS);
    expect(queueRows().every(li => li.hasAttribute('data-loading-item'))).toBe(true);
    expect(loadingChips().map(el => el.textContent?.trim())).toEqual([
      'Incidents',
      'Approval requests',
      'Tickets',
      'Cloud tenants',
      'Software',
      'Devices',
    ]);
  });

  it('draws no quick action for a category gated off', async () => {
    env.saas = false;
    delete env.reports.software;
    await render();
    expect(loadingChips().map(el => el.textContent?.trim())).toEqual([
      'Approval requests',
      'Cloud tenants',
      'Software',
    ]);
  });

  it("draws each row in the loaded row's boxes: 48px, the item, the tag, the two action cells", async () => {
    await act(async () => {
      root.render(<NeedsYouPanel loading />);
    });
    for (const li of queueRows()) {
      expect(li.className).toContain('h-12');
      expect(li.children).toHaveLength(4);
      expect(li.children[2].className).toContain('w-12');
      expect(li.children[3].className).toContain('w-12');
    }
  });

  it('is the panel itself, which the shell can hold with no source behind it: every quick action', async () => {
    await act(async () => {
      root.render(<NeedsYouPanel loading />);
    });
    expect(env.mounted.size).toBe(0);
    expect(isLoading()).toBe(true);
    expect(queueRows()).toHaveLength(NEEDS_YOU_ROWS);
    expect(loadingChips()).toHaveLength(6);
  });
});

describe('NeedsYouCard queue', () => {
  it('shows the newest three across sources, each with Fix with Mingo and an open link to its page', async () => {
    env.reports.approvals = ready(row('approvals', '1', 10, routes.tickets.dialog('t-1')));
    env.reports.incidents = { status: 'ready', rows: [row('incidents', '1', 40)], count: 1 };
    env.reports.tenants = ready(row('tenants', '1', 30));
    env.reports.software = ready(row('software', '1', 20));
    await render();
    expect(isLoading()).toBe(false);
    expect(rowNames()).toEqual(['incidents 1', 'tenants 1', 'software 1']);
    expect(control('Fix with Mingo: incidents 1')).not.toBeNull();
    expect(control('Open incidents 1')?.getAttribute('href')).toBe('/incidents/1');
  });

  it('keeps its three-row box with one row', async () => {
    env.reports.software = ready(row('software', '1', 20));
    await render();
    expect(queueBox()?.className).toContain('h-36');
    expect(rowNames()).toEqual(['software 1']);
  });

  it('says All Clear in the same box when nothing needs the user', async () => {
    await render();
    expect(queueBox()?.className).toContain('h-36');
    expect(queueRows()).toHaveLength(0);
    expect(queueBox()?.querySelector('[role="status"]')?.textContent).toBe('All ClearNo items need your attention');
  });

  it('opening a row takes it out of the queue, the next one moves up, and it stays out on the next visit', async () => {
    env.reports.approvals = ready(row('approvals', '1', 50), row('approvals', '2', 40));
    env.reports.software = ready(row('software', '1', 30), row('software', '2', 20));
    await render();
    expect(rowNames()).toEqual(['approvals 1', 'approvals 2', 'software 1']);

    await act(async () => {
      control('Open approvals 1')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(rowNames()).toEqual(['approvals 2', 'software 1', 'software 2']);

    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(rowNames()).toEqual(['approvals 2', 'software 1', 'software 2']);
  });

  it('Fix with Mingo sends the row to Mingo in a new chat and takes it out of the queue', async () => {
    const asked = row('software', '1', 30);
    env.reports.software = ready(asked, row('software', '2', 20));
    await render();
    await act(async () => {
      control('Fix with Mingo: software 1')?.click();
    });
    expect(useMingoLauncherStore.getState().dockRequest).toEqual({
      kind: 'prompt',
      prompt: needsYouMingoPrompt(asked),
    });
    expect(rowNames()).toEqual(['software 2']);
  });

  it('Fix with Mingo is off while Mingo cannot take a chat (no dock)', async () => {
    useMingoLauncherStore.setState({ dockMounted: false });
    env.reports.software = ready(row('software', '1', 30));
    await render();
    expect(control('Fix with Mingo: software 1')?.hasAttribute('disabled')).toBe(true);
  });
});

describe('NeedsYouCard quick actions', () => {
  it('one per category with its count and page; a count of 0 is grey', async () => {
    env.reports.incidents = { status: 'ready', rows: [], count: 5 };
    env.reports.approvals = ready(row('approvals', '1', 1), row('approvals', '2', 2));
    env.reports.disk = { status: 'ready', rows: [], count: 15 };
    await render();
    expect(chips()).toEqual([
      ['Incidents (5)', routes.incidents.filtered({ status: ['NEW'] })],
      ['Approval requests (2)', routes.approvals],
      ['Tickets (2)', routes.tickets.filtered({ status: ['tr-1'] })],
      ['Cloud tenants (0)', routes.cloudTenantManagement.list],
      ['Software (0)', routes.software.actionsFiltered({ status: ['FAILED'] })],
      ['Devices (15)', routes.devices.list],
    ]);
    expect(control('Software (0)')?.querySelector('.text-ods-text-secondary')?.textContent).toBe('(0)');
    expect(control('Incidents (5)')?.querySelector('.text-ods-text-secondary')).toBeNull();
    // A grey category with something in it keeps its count in the label's colour.
    expect(control('Devices (15)')?.querySelector('.text-ods-text-secondary')).toBeNull();
  });

  it('no quick action for a category gated off', async () => {
    env.saas = false;
    await render();
    expect(chips().map(([text]) => text)).toEqual(['Approval requests (0)', 'Cloud tenants (0)', 'Software (0)']);
  });

  it('a failed source: its quick action shows (—) and retries, and the other rows still show', async () => {
    env.tenantsFail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    env.reports.software = ready(row('software', '1', 30));
    await render();
    expect(isLoading()).toBe(false);
    expect(rowNames()).toEqual(['software 1']);
    const retry = control("Couldn't load cloud tenants. Retry");
    expect(retry?.textContent).toBe('Cloud tenants (—)');

    env.tenantsFail = false;
    env.reports.tenants = ready(row('tenants', '1', 40));
    await act(async () => {
      retry?.click();
    });
    expect(rowNames()).toEqual(['tenants 1', 'software 1']);
    expect(control('Cloud tenants (1)')).not.toBeNull();
  });

  it('offline, a failed quick action still opens its page, with no retry', async () => {
    env.reports.software = { status: 'error', isOffline: true, retry: () => {} };
    await render();
    const chip = Array.from(container.querySelectorAll('a')).find(a => a.textContent === 'Software (—)');
    expect(chip?.getAttribute('href')).toBe(routes.software.actionsFiltered({ status: ['FAILED'] }));
    expect(container.querySelector('[aria-label$=". Retry"]')).toBeNull();
  });
});
