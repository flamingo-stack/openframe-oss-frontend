/**
 * The device tab asks the server for this device's tickets. It used to page through the
 * whole tenant (100 a page) and match in the browser, which both over-fetched and declared
 * "Ticket history empty" off the first page alone — so what matters here is the request's
 * scope and that the empty state waits for the server to have nothing further to page in.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../../types/device.types';
import { TicketsTab } from './tickets-tab';

const hooks = vi.hoisted(() => ({ useTicketsQuery: vi.fn() }));

vi.mock('../../../tickets/hooks/use-tickets-query', () => ({ useTicketsQuery: hooks.useTicketsQuery }));
vi.mock('@/app/hooks/use-user-status-map', () => ({ useUserStatusMap: () => ({ isUserDeleted: () => false }) }));
vi.mock('@/app/hooks/use-sticky-toolbar', () => ({
  useStickyToolbar: () => ({ toolbarRef: { current: null }, containerStyle: {}, stickyHeaderOffset: 0 }),
}));
// Something under the shared ticket columns reaches a Relay-tagged devices query; the tag needs
// the Babel transform vitest does not run, and nothing here executes it.
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/devices/details',
  useSearchParams: () => new URLSearchParams(),
}));

// The lib measures text for truncation tooltips and reads viewport queries; jsdom has neither.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
// The infinite footer watches its sentinel with an IntersectionObserver; it never has to fire here.
globalThis.IntersectionObserver ??= ResizeObserverStub as unknown as typeof IntersectionObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

const DEVICE = { id: 'mongo-1', machineId: 'machine-1', hostname: 'laptop-01' } as unknown as Device;

const idle = {
  dialogs: [],
  filteredCount: 0,
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  error: null,
  resetToFirstPage: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

function render(device: Device | null) {
  act(() => {
    root.render(<TicketsTab device={device} />);
  });
}

function lastQueryArgs(): Record<string, unknown> {
  return hooks.useTicketsQuery.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  hooks.useTicketsQuery.mockReset();
  hooks.useTicketsQuery.mockReturnValue(idle);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('TicketsTab', () => {
  it('scopes the list to the device by machine id, at the default page size', () => {
    render(DEVICE);

    expect(lastQueryArgs()).toMatchObject({ archived: false, deviceIds: ['machine-1'], enabled: true });
    expect(lastQueryArgs()).not.toHaveProperty('pageSize');
  });

  it('holds the request while the device is unknown rather than listing the tenant', () => {
    render(null);

    expect(lastQueryArgs()).toMatchObject({ deviceIds: [], enabled: false });
  });

  it('shows the empty state only once the server has no further page', () => {
    hooks.useTicketsQuery.mockReturnValue({ ...idle, hasNextPage: true });
    render(DEVICE);
    expect(container.textContent).not.toContain('Ticket history empty');

    hooks.useTicketsQuery.mockReturnValue({ ...idle, hasNextPage: false });
    render(DEVICE);
    expect(container.textContent).toContain('Ticket history empty');
  });
});
