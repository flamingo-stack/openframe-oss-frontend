/**
 * Each tab of the user page reads on its own. One that fails must draw its own error under the tab bar and leave the
 * title and the other tabs, never replace the whole page.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  useLazyLoadQuery: () => ({ directoryUser: null }),
}));
vi.mock('./user-detail-header', () => ({
  USER_DETAIL_TITLE: 'User',
  UserTitle: () => <h1>User</h1>,
  UserDetailHeader: () => <h1>Olivia Grant</h1>,
}));
vi.mock('./user-details-tab', () => ({ UserDetailsTab: () => <div>details</div> }));
vi.mock('./user-devices-tab', () => ({
  UserDevicesTab: () => {
    throw new Error('directoryAccount failed');
  },
}));
vi.mock('./user-groups-tab', () => ({ UserGroupsTab: () => <div>groups</div> }));
vi.mock('./user-licences-tab', () => ({ UserLicencesTab: () => <div>licences</div> }));

import { UserDetailView } from './user-detail-view';

let container: HTMLDivElement;
let root: Root;

describe('UserDetailView, a failing tab', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // The tab bar measures itself.
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;
    // The tab bar reads the tab from the address: no Next router is registered with the lib here.
    window.history.replaceState(null, '', '/users/details?id=acc-1&tab=devices');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('keeps the title and the tab bar, and says which tab failed', async () => {
    await act(async () => {
      root.render(<UserDetailView id="acc-1" />);
    });
    expect(container.textContent).toContain('Olivia Grant');
    expect(container.textContent).toContain('Licences');
    expect(container.textContent).toContain("Couldn't load this user's devices.");
  });
});
