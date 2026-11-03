/**
 * The user page's title (Figma 1014:1222, 1019:38344): the person's initials, and a READ ONLY tag when the provider
 * will not take a change to this account. Edit User stays either way, for the fields OpenFrame keeps itself.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-relay', () => ({ graphql: () => null, useFragment: (_: unknown, ref: unknown) => ref }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/users/details',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => () => undefined }));

import { UserDetailHeader } from './user-detail-header';

let container: HTMLDivElement;
let root: Root;

function person(readOnlyReasons: string[], customers = 1) {
  return {
    displayName: 'Andrii Kachur',
    accounts: [
      {
        id: 'acc-1',
        readOnlyReasons,
        customers: Array.from({ length: customers }, () => ({ __typename: 'DirectoryConnectionCustomer' })),
        details: { jobTitle: 'Engineer' },
      },
    ],
  } as never;
}

describe('UserDetailHeader', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("draws the person's initials beside the name", () => {
    act(() => root.render(<UserDetailHeader person={person([])} />));
    expect(container.textContent).toContain('AK');
    expect(container.textContent).toContain('Andrii Kachur');
  });

  it('tags an account the provider will not change as read only, and keeps Edit User', () => {
    act(() => root.render(<UserDetailHeader person={person(['MASTERED_ON_PREMISES'])} />));
    expect(container.textContent).toMatch(/read only/i);
    expect(container.textContent).toContain('Edit User');
  });

  it('draws no tag on an account it can change', () => {
    act(() => root.render(<UserDetailHeader person={person([])} />));
    expect(container.textContent).not.toMatch(/read only/i);
  });

  it('tags it on an account no customer claims too', () => {
    act(() => root.render(<UserDetailHeader person={person(['DISCONNECTED'], 0)} />));
    expect(container.textContent).toMatch(/read only/i);
  });
});
