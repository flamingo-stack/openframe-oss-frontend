/**
 * Pins what the "Added by" cell of the device card shows for each answer the
 * user's node can give about the id the device carries: no id, a read in flight,
 * a live user, a deleted account, a user the API no longer knows, and a failed
 * read.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { toGlobalId } from '@/lib/relay-id';
import { DeviceAddedByCell } from './device-added-by-cell';

type NodeAnswer = { node: Record<string, unknown> | null } | 'loading' | Error;

const { answer, useLazyLoadQuery } = vi.hoisted(() => {
  const state: { value: NodeAnswer } = { value: { node: null } };
  const pending = new Promise(() => {});
  return {
    answer: state,
    useLazyLoadQuery: vi.fn((_query: unknown, _variables: { id: string }) => {
      if (state.value === 'loading') throw pending;
      if (state.value instanceof Error) throw state.value;
      return state.value;
    }),
  };
});

vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery }));

// The lib measures text for truncation tooltips; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const JANE = {
  __typename: 'User',
  email: 'jane@acme.com',
  firstName: 'Jane',
  lastName: 'Doe',
  status: 'ACTIVE',
  image: null,
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
  answer.value = { node: null };
  useLazyLoadQuery.mockClear();
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
    expect(useLazyLoadQuery).not.toHaveBeenCalled();
    expect(deletedAvatar()).toBeNull();
  });

  it('shows a placeholder, not a name, while the user is being read', () => {
    answer.value = 'loading';
    render('user-1');

    expect(useLazyLoadQuery.mock.calls[0][1]).toEqual({ id: toGlobalId('User', 'user-1') });
    expect(container.textContent?.trim()).toBe('Added by');
    expect(deletedAvatar()).toBeNull();
  });

  it('shows the full name of a live user', () => {
    answer.value = { node: JANE };
    render('user-1');

    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).toContain('Added by');
    expect(deletedAvatar()).toBeNull();
  });

  it('falls back to the email of a user without a name', () => {
    answer.value = { node: { ...JANE, firstName: '', lastName: null } };
    render('user-1');

    expect(container.textContent).toContain('jane@acme.com');
  });

  it.each(['DELETED', 'SELF_DELETED'])('shows the deleted avatar beside the returned name for a %s account', status => {
    answer.value = { node: { ...JANE, status } };
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
    answer.value = new Error('Relay fetch failed: 500');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render('user-1');
    consoleError.mockRestore();

    expect(container.textContent).toBe(`${EMPTY_VALUE}Added by`);
    expect(deletedAvatar()).toBeNull();
  });
});
