/**
 * Pins what the "Added by" cell of the device card shows for each answer the
 * users API can give about the id the device carries: no id, a read in flight,
 * a live user, a deleted account, a user the API no longer knows, and a failed
 * read.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { DeviceAddedByCell } from './device-added-by-cell';

type UserAnswer = {
  user: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
};

const { answer, useUser } = vi.hoisted(() => {
  const state: { value: UserAnswer } = { value: { user: null, isLoading: false, error: null } };
  return { answer: state, useUser: vi.fn((_userId: string) => state.value) };
});

vi.mock('@/app/(app)/settings/hooks/use-user', () => ({ useUser }));

// The deleted-user helpers read the status enum from the users hooks, which load the api-client and the auth store.
vi.mock('@/app/(app)/settings/hooks/use-users', () => ({
  UserStatus: { Active: 'ACTIVE', Deleted: 'DELETED', SelfDeleted: 'SELF_DELETED' },
}));

// The lib measures text for truncation tooltips; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const JANE = {
  id: 'user-1',
  email: 'jane@acme.com',
  firstName: 'Jane',
  lastName: 'Doe',
  roles: [],
  status: 'ACTIVE',
};

let root: Root;
let container: HTMLDivElement;

function render(userId: string | null | undefined) {
  act(() => {
    root.render(<DeviceAddedByCell userId={userId} />);
  });
}

const deletedAvatar = () => container.querySelector('[role="img"][aria-label^="Deleted user"]');

beforeEach(() => {
  answer.value = { user: null, isLoading: false, error: null };
  useUser.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DeviceAddedByCell', () => {
  it('shows the empty mark, and reads no user, for a device that carries no id', () => {
    render(null);

    expect(container.textContent).toBe(`${EMPTY_VALUE}Added by`);
    expect(useUser).toHaveBeenCalledWith('');
    expect(deletedAvatar()).toBeNull();
  });

  it('shows a placeholder, not a name, while the user is being read', () => {
    answer.value = { user: null, isLoading: true, error: null };
    render('user-1');

    expect(useUser).toHaveBeenCalledWith('user-1');
    expect(container.textContent?.trim()).toBe('Added by');
    expect(deletedAvatar()).toBeNull();
  });

  it('shows the full name of a live user', () => {
    answer.value = { user: JANE, isLoading: false, error: null };
    render('user-1');

    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).toContain('Added by');
    expect(deletedAvatar()).toBeNull();
  });

  it('falls back to the email of a user without a name', () => {
    answer.value = { user: { ...JANE, firstName: '', lastName: undefined }, isLoading: false, error: null };
    render('user-1');

    expect(container.textContent).toContain('jane@acme.com');
  });

  it.each(['DELETED', 'SELF_DELETED'])('shows the deleted avatar beside the returned name for a %s account', status => {
    answer.value = { user: { ...JANE, status }, isLoading: false, error: null };
    render('user-1');

    expect(container.textContent).toContain('Jane Doe');
    expect(deletedAvatar()?.getAttribute('aria-label')).toBe('Deleted user: Jane Doe');
  });

  it('shows the deleted-employee placeholder for a user the API no longer knows', () => {
    render('user-gone');

    expect(container.textContent).toContain('Deleted Employee');
    expect(deletedAvatar()).not.toBeNull();
  });

  it('shows the empty mark when the read fails', () => {
    answer.value = { user: null, isLoading: false, error: 'Failed to load employee (500)' };
    render('user-1');

    expect(container.textContent).toBe(`${EMPTY_VALUE}Added by`);
    expect(deletedAvatar()).toBeNull();
  });
});
