/**
 * The user page's title (Figma 1014:1222, 1019:38344): the person's initials, and a READ ONLY tag when the provider
 * will not take a change to this account. Edit User stays either way, for the fields OpenFrame keeps itself.
 * Suspend sits beside it (the brief's "Suspend and Offboard in the header"): one click each way, off with its reason
 * where the account cannot be written, absent on an account no provider holds.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const relay = vi.hoisted(() => ({ commit: vi.fn(), inFlight: false }));

vi.mock('react-relay', () => ({
  graphql: () => null,
  useFragment: (_: unknown, ref: unknown) => ref,
  useMutation: () => [relay.commit, relay.inFlight],
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/users/details',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => () => undefined }));
// Radix measures an open tooltip's trigger; jsdom has no ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { readOnlyTooltip } from '../../utils/group-presentation';
import { UserDetailHeader } from './user-detail-header';

let container: HTMLDivElement;
let root: Root;

interface AccountShape {
  source?: string;
  status?: string;
  statusReason?: string | null;
  readOnlyReasons?: string[];
  customers?: number;
}

function person({
  source = 'MICROSOFT_365',
  status = 'ACTIVE',
  statusReason = null,
  readOnlyReasons = [],
  customers = 1,
}: AccountShape = {}) {
  return {
    displayName: 'Andrii Kachur',
    accounts: [
      {
        id: 'acc-1',
        source,
        status,
        statusReason,
        readOnlyReasons,
        customers: Array.from({ length: customers }, (_, index) => ({
          organization: { organizationId: `org-${index + 1}` },
        })),
        details: { jobTitle: 'Engineer' },
      },
    ],
  } as never;
}

const buttonNamed = (name: string) =>
  [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === name);

/** A live action's tooltip: PageActions' Radix tooltip opens on focus. */
function liveTooltip(name: string) {
  act(() => buttonNamed(name)?.focus());
  return document.querySelector('[role="tooltip"]');
}

/** An off action's reason: a disabled button takes no pointer events, so its FloatingTooltip hangs on the wrapper. */
function offReason(name: string) {
  act(() => {
    buttonNamed(name)?.parentElement?.dispatchEvent(new MouseEvent('mouseenter'));
  });
  return document.querySelector('[role="tooltip"]')?.textContent;
}

/** The action's row in the phone's "..." menu, which takes `disabled` and not `loading`. */
function phoneMenuRow(name: string) {
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
  act(() => {
    trigger?.focus();
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  return [...document.querySelectorAll('[role="menuitem"]')].find(row => row.textContent?.trim() === name);
}

describe('UserDetailHeader', () => {
  beforeEach(() => {
    relay.commit.mockReset();
    relay.inFlight = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("draws the person's initials beside the name", () => {
    act(() => root.render(<UserDetailHeader person={person()} />));
    expect(container.textContent).toContain('AK');
    expect(container.textContent).toContain('Andrii Kachur');
  });

  it('tags an account the provider will not change as read only, and keeps Edit User', () => {
    act(() => root.render(<UserDetailHeader person={person({ readOnlyReasons: ['MASTERED_ON_PREMISES'] })} />));
    expect(container.textContent).toMatch(/read only/i);
    expect(container.textContent).toContain('Edit User');
  });

  it('draws no tag on an account it can change', () => {
    act(() => root.render(<UserDetailHeader person={person()} />));
    expect(container.textContent).not.toMatch(/read only/i);
  });

  it('tags it on an account no customer claims too', () => {
    act(() => root.render(<UserDetailHeader person={person({ readOnlyReasons: ['DISCONNECTED'], customers: 0 })} />));
    expect(container.textContent).toMatch(/read only/i);
  });

  it('suspends an active provider account for the customer that claims it', () => {
    act(() => root.render(<UserDetailHeader person={person()} />));
    const suspend = buttonNamed('Suspend');
    expect(suspend?.disabled).toBe(false);

    act(() => suspend?.click());
    expect(relay.commit).toHaveBeenCalledTimes(1);
    expect(relay.commit.mock.calls[0][0].variables).toEqual({
      input: { id: 'acc-1', organizationId: 'org-1', suspended: true },
    });
  });

  it('unsuspends a suspended account', () => {
    act(() => root.render(<UserDetailHeader person={person({ source: 'GOOGLE_WORKSPACE', status: 'SUSPENDED' })} />));
    expect(buttonNamed('Suspend')).toBeUndefined();

    act(() => buttonNamed('Unsuspend')?.click());
    expect(relay.commit.mock.calls[0][0].variables.input).toEqual({
      id: 'acc-1',
      organizationId: 'org-1',
      suspended: false,
    });
  });

  it('turns Unsuspend off on an archived Google account, which only a licence change lifts', () => {
    act(() =>
      root.render(
        <UserDetailHeader
          person={person({ source: 'GOOGLE_WORKSPACE', status: 'SUSPENDED', statusReason: 'ARCHIVED' })}
        />,
      ),
    );
    expect(buttonNamed('Unsuspend')?.disabled).toBe(true);
    expect(offReason('Unsuspend')).toBe('Archived in Google Workspace: restore it from the Admin console.');
    expect(buttonNamed('Edit User')?.disabled).toBe(false);
  });

  it.each([
    ['MICROSOFT_365', 'ACTIVE', 'Suspend', /^Blocks sign-in at Microsoft 365\. .*does not start offboarding\.$/],
    ['MICROSOFT_365', 'SUSPENDED', 'Unsuspend', /^Allows sign-in at Microsoft 365 again\.$/],
    [
      'GOOGLE_WORKSPACE',
      'ACTIVE',
      'Suspend',
      /^Suspends the user at Google Workspace\. .*does not start offboarding\.$/,
    ],
    ['GOOGLE_WORKSPACE', 'SUSPENDED', 'Unsuspend', /^Restores the user at Google Workspace\.$/],
  ])('says what %s %s → %s does at the provider', (source, status, label, copy) => {
    act(() => root.render(<UserDetailHeader person={person({ source, status })} />));
    expect(liveTooltip(label)?.textContent).toMatch(copy);
  });

  it('wraps the tooltip at the width FloatingTooltip wraps at', () => {
    act(() => root.render(<UserDetailHeader person={person()} />));
    liveTooltip('Suspend');
    const content = document.querySelector('[data-radix-popper-content-wrapper]');
    expect(content?.querySelector('.max-w-xs')?.textContent).toMatch(/^Blocks sign-in/);
  });

  it('draws no Suspend on an OpenFrame account, which no provider holds', () => {
    act(() => root.render(<UserDetailHeader person={person({ source: 'OPENFRAME' })} />));
    expect(buttonNamed('Suspend')).toBeUndefined();
    expect(buttonNamed('Unsuspend')).toBeUndefined();
    expect(container.textContent).toContain('Edit User');
  });

  it('turns Suspend off on an account the provider will not change, and sends nothing', () => {
    act(() => root.render(<UserDetailHeader person={person({ readOnlyReasons: ['PAUSED'] })} />));
    const suspend = buttonNamed('Suspend');
    expect(suspend?.disabled).toBe(true);
    expect(offReason('Suspend')).toBe(readOnlyTooltip(['PAUSED']));
    act(() => suspend?.click());
    expect(relay.commit).not.toHaveBeenCalled();
    expect(buttonNamed('Edit User')?.disabled).toBe(false);
  });

  it('turns Suspend and Edit User off on an account no customer claims', () => {
    act(() => root.render(<UserDetailHeader person={person({ customers: 0 })} />));
    expect(buttonNamed('Suspend')?.disabled).toBe(true);
    expect(offReason('Suspend')).toBe("No customer claims this user yet, so its sign-in can't be changed.");
    expect(buttonNamed('Edit User')?.disabled).toBe(true);
  });

  it("offers Suspend in the phone's menu", () => {
    act(() => root.render(<UserDetailHeader person={person()} />));
    expect(phoneMenuRow('Suspend')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('holds Suspend while its write is out, on the phone too', () => {
    relay.inFlight = true;
    act(() => root.render(<UserDetailHeader person={person()} />));
    const suspend = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Suspend'));
    expect(suspend?.disabled).toBe(true);
    expect(phoneMenuRow('Suspend')?.getAttribute('aria-disabled')).toBe('true');
  });
});
