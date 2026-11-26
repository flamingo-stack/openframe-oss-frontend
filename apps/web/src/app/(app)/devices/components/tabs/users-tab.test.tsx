/**
 * Device > Local Accounts: the search finds accounts by their name and nothing else, and its placeholder says so. A
 * group named like the term (`Administrators` for `Administrator`) does not bring its members along.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubTableBrowserApis } from '@/app/components/shared/table-grid-flag.fixtures';
import type { Device } from '../../types/device.types';
import { UsersTab } from './users-tab';

vi.mock('@/app/hooks/use-sticky-toolbar', () => ({
  useStickyToolbar: () => ({ toolbarRef: { current: null }, containerStyle: {}, stickyHeaderOffset: 'top-[56px]' }),
}));

/** The tab's search debounce (`useDebounce(search, 300)`). */
const SEARCH_DEBOUNCE_MS = 300;

const DEVICE = {
  id: 'device-1',
  machineId: 'machine-1',
  users: [
    { username: 'Administrator', uid: 500, type: 'person', groupname: 'Administrators', shell: '' },
    { username: 'roman', uid: 1001, type: 'person', groupname: 'Administrators', shell: '' },
    { username: 'Guest', uid: 501, type: 'person', groupname: 'Guests', shell: '' },
    { username: 'svc-backup', uid: 1002, type: 'service', groupname: 'Users', shell: '' },
  ],
} as unknown as Device;

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<UsersTab device={DEVICE} />));
}

function searchInput() {
  const input = container.querySelector<HTMLInputElement>('input[placeholder]');
  if (!input) throw new Error('no search box');
  return input;
}

/** A search as the viewer makes it: the keystroke as React sees it, then the debounce running out. */
function search(value: string) {
  const input = searchInput();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => {
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
}

const shown = (name: string) => container.textContent?.includes(name) ?? false;

beforeAll(stubTableBrowserApis);
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('UsersTab search', () => {
  it('says it searches for an account', () => {
    render();
    expect(searchInput().placeholder).toBe('Search for Account');
  });

  it('finds the account by its name, not the accounts of a group named like it', () => {
    render();
    search('Administrator');
    expect(shown('Administrator')).toBe(true);
    // `roman` is in the `Administrators` group: the group is not searched.
    expect(shown('roman')).toBe(false);
    expect(shown('Guest')).toBe(false);
  });

  it('matches any part of the name, whatever its case', () => {
    render();
    search('BACK');
    expect(shown('svc-backup')).toBe(true);
    expect(shown('Administrator')).toBe(false);
  });

  it('does not match the type, the UID or the group', () => {
    render();
    search('service');
    expect(shown('svc-backup')).toBe(false);
    search('1001');
    expect(shown('roman')).toBe(false);
    search('Guests');
    expect(shown('No results for "Guests".')).toBe(true);
  });

  it('shows the no-results state and keeps the search to clear it', () => {
    render();
    search('nobody');
    expect(shown('No local accounts found')).toBe(true);
    expect(shown('No results for "nobody".')).toBe(true);
    expect(searchInput().value).toBe('nobody');
  });
});
