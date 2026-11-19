/**
 * The outdated-client bar (CU-17tkuw66v9b): the count is the server's `"true"` option of the outdated-client facet
 * under the default Devices statuses, 0 while it is not asked (locked, signed out, subscription unanswered), before it
 * answers and when it fails; Manage Devices opens the Devices list with outdated clients first.
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  open: true,
  pathname: '/dashboard/',
  deviceFilters: undefined as undefined | { clientOutdated: { value: string; count: number }[] },
  asked: [] as { variables: unknown; enabled: boolean }[],
  refetched: 0,
}));

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useRelayEnvironment: () => ({}),
  fetchQuery: () => {
    state.refetched += 1;
    return { subscribe: () => ({ unsubscribe: () => undefined }) };
  },
}));
vi.mock('@/graphql/devices/outdated-client-count-relay', () => ({ outdatedClientCountRelayQuery: {} }));
vi.mock('@/app/hooks/use-non-suspending-query', () => ({
  useNonSuspendingQuery: (_query: unknown, variables: unknown, enabled: boolean) => {
    state.asked.push({ variables, enabled });
    return { data: { deviceFilters: enabled ? state.deviceFilters : undefined }, isLoading: false };
  },
}));
vi.mock('./subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => state.open }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));

import { OUTDATED_CLIENT_DEVICES_HREF, OutdatedClientBar, useOutdatedClientCount } from './outdated-client-bar';

let container: HTMLDivElement;
let root: Root;
let latest: number | null;

function Probe({ enabled }: { enabled: boolean }) {
  const value = useOutdatedClientCount(enabled);
  useEffect(() => {
    latest = value;
  });
  return null;
}

function count(enabled = true): number {
  act(() => root.render(<Probe enabled={enabled} />));
  return latest as number;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.open = true;
  state.pathname = '/dashboard/';
  state.deviceFilters = undefined;
  state.asked = [];
  state.refetched = 0;
  latest = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // A test that stubs `matchMedia` gets it back here, failed or not.
  vi.unstubAllGlobals();
});

describe('useOutdatedClientCount', () => {
  it('reads the "true" option, counted under the default Devices statuses', () => {
    state.deviceFilters = {
      clientOutdated: [
        { value: 'true', count: 3 },
        { value: 'false', count: 40 },
      ],
    };
    expect(count()).toBe(3);
    expect(state.asked.at(-1)).toEqual({
      variables: {
        filter: expect.objectContaining({ statuses: ['ONLINE', 'OFFLINE', 'PENDING_DELETION'] }),
        list: true,
      },
      enabled: true,
    });
  });

  it('is 0 before the answer and when the query failed (no data)', () => {
    expect(count()).toBe(0);
  });

  it('asks nothing while the subscription is not open, or the caller disables it', () => {
    state.deviceFilters = { clientOutdated: [{ value: 'true', count: 3 }] };
    state.open = false;
    expect(count()).toBe(0);
    expect(state.asked.at(-1)?.enabled).toBe(false);

    state.open = true;
    expect(count(false)).toBe(0);
    expect(state.asked.at(-1)?.enabled).toBe(false);
  });

  it('asks again when the user enters the Devices section, not elsewhere', () => {
    count();
    expect(state.refetched).toBe(0);
    state.pathname = '/devices/';
    count();
    expect(state.refetched).toBe(1);
  });
});

describe('OutdatedClientBar', () => {
  it('says what to do and opens the Devices list with outdated clients first', () => {
    const onManage = vi.fn();
    act(() => root.render(<OutdatedClientBar onManage={onManage} />));
    expect(container.textContent).toContain('Some devices run an outdated agent. Reinstall it to keep them connected.');

    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Manage Devices');
    act(() => button?.click());
    expect(onManage).toHaveBeenCalled();
    expect(OUTDATED_CLIENT_DEVICES_HREF).toBe('/devices?sort=clientOutdated');
  });

  it('says the short message below sm, where the full one is cut off, and the full one from sm up (CU-17tkuw67m8q)', () => {
    act(() => root.render(<OutdatedClientBar onManage={vi.fn()} />));
    const spans = [...container.querySelectorAll('span')];
    const short = spans.find(s => s.textContent === 'Some devices need the agent reinstalled.');
    const full = spans.find(
      s => s.textContent === 'Some devices run an outdated agent. Reinstall it to keep them connected.',
    );
    expect(short?.className.split(' ')).toContain('sm:hidden');
    expect(full?.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'sm:inline']));
    expect(short?.closest('p')?.className.split(' ')).toEqual(expect.arrayContaining(['truncate', 'text-h6']));
  });

  it('opens the Devices list when the bar itself is tapped below md', () => {
    const onManage = vi.fn();
    // A phone: the md query does not match, so the row is the tap target (jsdom has no matchMedia of its own).
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    act(() => root.render(<OutdatedClientBar onManage={onManage} />));
    const text = [...container.querySelectorAll('span')].find(
      s => s.textContent === 'Some devices need the agent reinstalled.',
    );
    act(() => text?.click());
    expect(onManage).toHaveBeenCalledTimes(1);
  });
});
