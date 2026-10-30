/**
 * Where the overview cards lead: every href comes from the route registry. Devices
 * open the list with their status (the product's PENDING, not "pending deletion"),
 * Archived the archive page. Tickets open the bare list on the dashboard, as they
 * always have, and — with `filterLinks` (Mingo's home) — the list narrowed to the
 * tenant's status ids behind each card's kind. Each section's header opens its list.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { DevicesOverviewSection } from './devices-overview';
import { TicketsOverviewSection } from './tickets-overview';

const STATUSES = [
  { id: 's-ai', kind: 'AI_ASSISTANCE' },
  { id: 's-tech', kind: 'TECH_REQUIRED' },
  { id: 's-waiting', kind: 'CUSTOM' },
  { id: 's-vendor', kind: 'CUSTOM' },
  { id: 's-resolved', kind: 'RESOLVED' },
  { id: 's-archived', kind: 'ARCHIVED' },
];

const statusesQuery = vi.hoisted(() => ({ enabledCalls: [] as boolean[] }));

vi.mock('@/app/components/shared', () => ({ SectionLoadError: () => null }));
vi.mock('../hooks/use-dashboard-stats', () => {
  const state = { isLoading: false, isOffline: false, error: null, refetch: () => {} };
  return {
    useDevicesOverview: () => ({
      ...state,
      total: 10,
      active: 4,
      inactive: 3,
      pending: 2,
      archived: 1,
      activePercentage: 40,
      inactivePercentage: 30,
      pendingPercentage: 20,
      archivedPercentage: 10,
    }),
    useTicketsOverview: () => ({ ...state, aiAssistance: 5, techRequired: 2, resolved: 9, otherStatuses: 1 }),
  };
});
vi.mock('../../tickets/statuses/hooks/use-ticket-statuses-query', () => ({
  useTicketStatusesQuery: ({ enabled }: { enabled: boolean }) => {
    statusesQuery.enabledCalls.push(enabled);
    return { data: enabled ? { snapshot: STATUSES } : undefined };
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  statusesQuery.enabledCalls = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The header's "> {list}" action: drawn twice, labelled and (below `content-md`) as its
 * icon named by `aria-label`. Every other link is a card's.
 */
const isHeaderLink = (a: Element) => {
  const name = a.getAttribute('aria-label') ?? a.textContent?.trim();
  return name === 'Devices' || name === 'Tickets';
};
const headerLinks = () =>
  Array.from(container.querySelectorAll('a'))
    .filter(isHeaderLink)
    .map(a => a.getAttribute('href'));
const hrefs = () =>
  Array.from(container.querySelectorAll('a'))
    .filter(a => !isHeaderLink(a))
    .map(a => a.getAttribute('href'));

describe('DevicesOverviewSection', () => {
  it('opens the list filtered by each status, and the archive', () => {
    act(() => root.render(<DevicesOverviewSection />));
    expect(hrefs()).toEqual([
      routes.devices.filtered({ statuses: ['ONLINE'] }),
      routes.devices.filtered({ statuses: ['OFFLINE'] }),
      routes.devices.filtered({ statuses: ['PENDING'] }),
      routes.devices.archive,
    ]);
    expect(container.textContent).toContain('Pending Devices');
  });

  it('opens the Devices list from its header', () => {
    act(() => root.render(<DevicesOverviewSection />));
    expect(headerLinks()).toEqual([routes.devices.list, routes.devices.list]);
  });
});

describe('TicketsOverviewSection', () => {
  it('opens the bare list on the dashboard, without reading the statuses', () => {
    act(() => root.render(<TicketsOverviewSection />));
    expect(hrefs()).toEqual(Array(4).fill(routes.tickets.list));
    expect(statusesQuery.enabledCalls.every(enabled => !enabled)).toBe(true);
  });

  it('opens the list narrowed to the status ids behind each card', () => {
    act(() => root.render(<TicketsOverviewSection filterLinks />));
    expect(hrefs()).toEqual([
      routes.tickets.filtered({ status: ['s-ai'] }),
      routes.tickets.filtered({ status: ['s-tech'] }),
      routes.tickets.filtered({ status: ['s-resolved'] }),
      routes.tickets.filtered({ status: ['s-waiting', 's-vendor'] }),
    ]);
    expect(hrefs()[3]).toBe('/tickets?status=s-waiting&status=s-vendor');
  });

  it('opens the Tickets list from its header', () => {
    act(() => root.render(<TicketsOverviewSection filterLinks />));
    expect(headerLinks()).toEqual([routes.tickets.list, routes.tickets.list]);
  });
});
