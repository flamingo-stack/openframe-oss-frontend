/**
 * What a suspend says once it answers: done, done with Microsoft's open sessions named, done with the provider's
 * re-read lagging, or refused.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ commit: vi.fn(), toast: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => null, useMutation: () => [mocks.commit, false] }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: mocks.toast }),
}));

import { useSuspendUser } from './use-suspend-user';

const TARGET = { accountId: 'acc-1', organizationId: 'org-1', name: 'Olivia Grant' };

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useSuspendUser> | null;

function Probe() {
  const value = useSuspendUser();
  useEffect(() => {
    hook = value;
  });
  return null;
}

/** Runs the write and answers it as the server would. */
function answer(
  suspended: boolean,
  payload: { sessionsStillOpen?: boolean | null; userErrors?: unknown[]; person?: unknown },
) {
  act(() => hook?.setSuspended(TARGET, suspended));
  const config = mocks.commit.mock.calls.at(-1)?.[0];
  act(() =>
    config.onCompleted({
      setDirectoryUserSuspended: {
        person: 'person' in payload ? payload.person : {},
        sessionsStillOpen: payload.sessionsStillOpen ?? null,
        userErrors: payload.userErrors ?? [],
      },
    }),
  );
  return mocks.toast.mock.calls.at(-1)?.[0];
}

describe('useSuspendUser', () => {
  beforeEach(() => {
    mocks.commit.mockReset();
    mocks.toast.mockReset();
    hook = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Probe />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('says the user can no longer sign in', () => {
    expect(answer(true, {})).toEqual({
      title: 'User suspended',
      description: 'Olivia Grant can no longer sign in.',
      variant: 'success',
    });
  });

  it("names Microsoft's sessions that stay open", () => {
    expect(answer(true, { sessionsStillOpen: true }).description).toBe(
      'Olivia Grant can no longer sign in. Sessions already open stay open until they are revoked.',
    );
  });

  it('says an unsuspended user can sign in again', () => {
    expect(answer(false, { sessionsStillOpen: false })).toEqual({
      title: 'User unsuspended',
      description: 'Olivia Grant can sign in again.',
      variant: 'success',
    });
  });

  it('warns when the provider took it and its re-read lags', () => {
    const toast = answer(true, {
      sessionsStillOpen: true,
      userErrors: [{ code: 'SYNC_PENDING', message: 'The provider has not shown it yet.', field: null }],
    });
    expect(toast.title).toBe('User suspended');
    expect(toast.variant).toBe('warning');
    expect(toast.description).toContain('The provider has not shown it yet.');
    expect(toast.description).toContain('Sessions already open');
  });

  it('says it failed when the server refuses', () => {
    const toast = answer(true, {
      person: null,
      userErrors: [{ code: 'PERMISSION_DENIED', message: 'The connection may not change sign-in.', field: null }],
    });
    expect(toast).toMatchObject({ title: 'Could not suspend the user', variant: 'destructive' });
    expect(toast.description).toContain('The connection may not change sign-in.');
  });

  it('says it failed when the request does', () => {
    act(() => hook?.setSuspended(TARGET, false));
    act(() => mocks.commit.mock.calls.at(-1)?.[0].onError(new Error('Network down')));
    expect(mocks.toast.mock.calls.at(-1)?.[0]).toMatchObject({
      title: 'Could not unsuspend the user',
      variant: 'destructive',
    });
  });
});
