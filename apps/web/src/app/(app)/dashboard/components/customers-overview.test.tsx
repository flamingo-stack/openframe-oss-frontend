/**
 * Where a customer row's cards lead: the customer page, and the Devices list narrowed to
 * that customer — to its online / offline devices while it has any, else all of them.
 * Built by the route registry, not by hand.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { CustomersOverviewSection } from './customers-overview';

const row = (organizationId: string, active: number, inactive: number) => ({
  id: `node-${organizationId}`,
  organizationId,
  name: `Customer ${organizationId}`,
  websiteUrl: '',
  imageUrl: null,
  imageHash: null,
  total: active + inactive,
  active,
  inactive,
  activePct: 0,
  inactivePct: 0,
});

vi.mock('@/app/components/shared', () => ({ EmptyState: () => null }));
// The device cards' definitions live with the devices overview, whose counts read is not
// this test's (and pulls in a Relay query the test transform does not compile).
vi.mock('../hooks/use-dashboard-stats', () => ({ useDevicesOverview: () => undefined }));
vi.mock('../hooks/use-customers-overview', () => ({
  CUSTOMERS_OVERVIEW_LIMIT: 10,
  useCustomersOverview: () => ({
    rows: [row('org-1', 3, 1), row('org-2', 0, 0)],
    loading: false,
    isOffline: false,
    canClaimEmpty: true,
    error: null,
    totalOrganizations: 2,
    refresh: () => {},
  }),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('CustomersOverviewSection links', () => {
  it('opens the customer and its devices through the route registry', async () => {
    await act(async () => {
      root.render(<CustomersOverviewSection />);
    });
    expect(Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'))).toEqual([
      routes.customers.details('org-1'),
      '/devices?organizationIds=org-1&statuses=ONLINE',
      '/devices?organizationIds=org-1&statuses=OFFLINE',
      routes.customers.details('org-2'),
      '/devices?organizationIds=org-2',
      '/devices?organizationIds=org-2',
    ]);
  });
});
