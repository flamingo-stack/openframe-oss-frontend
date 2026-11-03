/**
 * The fields lock by the record the form was seeded from, the one Save diffs against. A refetch that lands on a dirty
 * form does not reseed it, so it must not unlock a field either: an edit there would be dropped by Save, which still
 * reads that field as locked, while the page toasts "User updated". Nor does a refetch that finds no user clear it, so
 * Save follows the read too.
 */

import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactNode, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditUserRecordState } from './edit-user-record-loader';

const { loader } = vi.hoisted(() => ({ loader: { state: { status: 'loading' } as unknown } }));

// `readInlineData` hands the node back: the fixture's records carry the nested fragments' fields flat.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
  useMutation: () => [vi.fn(), false],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PageLayout: ({ children, actions }: { children: ReactNode; actions: PageActionButton[] }) => (
    <main>
      {actions.map(({ label, disabled }) => (
        <button key={label} type="button" disabled={disabled}>
          {label}
        </button>
      ))}
      {children}
    </main>
  ),
}));
// The page's data island hands up whatever the test last loaded.
vi.mock('./edit-user-record-loader', () => ({
  EditUserRecordLoader: ({ onResolved }: { onResolved: (state: EditUserRecordState) => void }) => {
    const state = loader.state as EditUserRecordState;
    useLayoutEffect(() => onResolved(state), [onResolved, state]);
    return null;
  },
}));
// The manager picker reads the directory; nothing here is about it.
vi.mock('./manager-field', () => ({ ManagerField: () => null }));

import { LIVE_DETAILS, userRecord } from './__tests__/edit-user-fixtures';
import { EditUserView } from './edit-user-view';

/** The live read failed (`details` null) or answered. The local phone is stored, so it stays editable either way. */
function loaded(liveRead: boolean): EditUserRecordState {
  return { status: 'ready', record: userRecord({ phone: '+1 999', details: liveRead ? LIVE_DETAILS : null }) };
}

let container: HTMLDivElement;
let root: Root;

function input(label: string): HTMLInputElement {
  const found = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!found) throw new Error(`no ${label} input`);
  return found;
}

function saveButton(): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(button => button.textContent === 'Save User');
  if (!found) throw new Error('no Save User button');
  return found;
}

/** What a keystroke does: React reads the native value on the `input` event. */
function type(target: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('EditUserView, a refetch on a dirty form', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the fields locked as the seeded record has them', async () => {
    loader.state = loaded(false);
    act(() => root.render(<EditUserView id="acc-1" />));
    expect(input('First Name').disabled).toBe(true);

    // Async: react-hook-form publishes `isDirty` once the change's validation has answered.
    await act(async () => type(input('Phone'), '+1 998'));
    loader.state = loaded(true);
    act(() => root.render(<EditUserView id="acc-1" />));

    expect(input('Phone').value).toBe('+1 998');
    expect(input('First Name').disabled).toBe(true);
  });

  it('opens them when the refetch lands on a pristine form', () => {
    loader.state = loaded(false);
    act(() => root.render(<EditUserView id="acc-1" />));
    loader.state = loaded(true);
    act(() => root.render(<EditUserView id="acc-1" />));

    expect(input('First Name').disabled).toBe(false);
  });

  it('disables Save once the refetch finds no user', () => {
    loader.state = loaded(true);
    act(() => root.render(<EditUserView id="acc-1" />));
    expect(saveButton().disabled).toBe(false);

    loader.state = { status: 'missing' } satisfies EditUserRecordState;
    act(() => root.render(<EditUserView id="acc-1" />));
    expect(container.textContent).toContain('User not found');
    expect(saveButton().disabled).toBe(true);
  });
});
