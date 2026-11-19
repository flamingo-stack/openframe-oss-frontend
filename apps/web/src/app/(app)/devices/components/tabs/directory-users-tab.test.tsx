/**
 * Device > Users on a tenant with directories, in its two layouts: card rows by default, and the lib's grid table
 * where the grid is asked for, with a one-line cell in every data column and the open action in a column of its own.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../../types/device.types';
import { DirectoryUsersTab } from './directory-users-tab';

// The tab's one query, answered here; the account fragment is read by `toAccountRow`, which hands back what it is given.
const answer = vi.hoisted(() => ({ users: [] as unknown[] }));
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useLazyLoadQuery: () => ({ deviceDirectory: { users: answer.users } }),
}));
vi.mock('@/graphql/directory/account-row-fields', () => ({ toAccountRow: (account: object) => account }));
vi.mock('@/app/components/shared', async () => {
  const layout = await import('@/app/components/shared/table-column-layout');
  return {
    liveColumnMeta: layout.liveColumnMeta,
    oneLineEmptyState: (description: string) => ({ description }),
    useRetryKey: () => 0,
  };
});
vi.mock('@/app/hooks/use-sticky-toolbar', () => ({
  useStickyToolbar: () => ({ toolbarRef: { current: null }, containerStyle: {}, stickyHeaderOffset: 'top-[56px]' }),
}));
vi.mock('@/lib/open-in-new-tab', () => ({ openInNewTab: () => () => {} }));

// The lib measures text for truncation tooltips and reads viewport queries; jsdom has neither.
class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= ObserverStub as unknown as typeof IntersectionObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

const DEVICE = { id: 'mongo-1', machineId: 'machine-1' } as unknown as Device;

const account = (over: object) => ({
  id: 'a-1',
  href: '/users/details?id=a-1',
  name: 'Roman Khutornoy',
  email: 'roman@greenvalley.example',
  providers: [],
  customers: [
    { name: 'Green Valley Manufacturing', imageUrl: undefined, claim: 'domain greenvalley.example' },
    { name: 'TechFlow Solutions', imageUrl: undefined, claim: null },
  ],
  status: 'ACTIVE',
  statusReason: null,
  statusDetail: null,
  lastSignInAt: null,
  signInData: 'UNAVAILABLE',
  connection: { name: 'Green Valley M365', provider: 'MICROSOFT' },
  ...over,
});
const USERS = [
  {
    link: 'DECLARED',
    groups: [
      { id: 'g-1', name: 'Finance' },
      { id: 'g-2', name: 'All staff' },
    ],
    account: account({}),
  },
  {
    link: 'OBSERVED',
    groups: [],
    account: account({ id: 'a-2', href: null, name: 'Jerome Park', email: null, customers: [], connection: null }),
  },
];

let container: HTMLDivElement;
let root: Root;

function render(tableLayout?: 'cards' | 'grid') {
  act(() => root.render(<DirectoryUsersTab device={DEVICE} tableLayout={tableLayout} />));
}

const columnTexts = (id: string) =>
  Array.from(container.querySelectorAll(`[data-grid-col="${id}"]`), cell => cell.textContent ?? '').slice(1);

beforeEach(() => {
  answer.users = USERS;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DirectoryUsersTab', () => {
  it('draws card rows by default: no grid table, no settings gear', () => {
    render();
    expect(container.textContent).toContain('Roman Khutornoy');
    expect(container.querySelector('[data-grid-root]')).toBeNull();
    expect(container.querySelector('[aria-label="Table settings"]')).toBeNull();
  });

  it('draws the grid table with its column settings, at its natural height, where the grid is asked for', () => {
    render('grid');
    expect(container.querySelector('[data-grid-root]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Table settings"]')).not.toBeNull();
    expect(container.querySelector('[data-grid-root] [style*="--data-table-max-height"]')).toBeNull();
    expect(container.textContent).toContain('2 results');
  });

  it('puts each card cell on one line: the role tag and the email beside the name, the sign-in beside the status', () => {
    render('grid');
    expect(columnTexts('user')[0]).toContain('Roman Khutornoy');
    expect(columnTexts('user')[0]).toContain('Primary user');
    expect(columnTexts('user')[0]).toContain('roman@greenvalley.example');
    // An account with no email shows the empty mark, as its card row does.
    expect(columnTexts('user')[1]).toMatch(/Jerome Park—$/);
    expect(columnTexts('status')[0]).toContain('Last sign-in:');
    // The first customer (its logo, or its initials) and name, then how many more and the tenant the account is in.
    expect(columnTexts('customer')[0]).toMatch(/Green Valley Manufacturing\+1 · Green Valley M365$/);
    expect(columnTexts('customer')[1]).toBe('—Added in OpenFrame');
    expect(columnTexts('group')).toEqual(['Finance+1', '—']);
    expect(container.querySelectorAll('[data-grid-root] [data-grid-col] .flex-col')).toHaveLength(0);
  });

  it('keeps the open action in a column of its own, inert for an account with no page', () => {
    render('grid');
    const open = (name: string) =>
      container.querySelector<HTMLButtonElement>(`button[aria-label="Open ${name} in new tab"]`);
    expect(open('Roman Khutornoy')?.disabled).toBe(false);
    expect(open('Jerome Park')?.disabled).toBe(true);
  });
});
