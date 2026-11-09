/**
 * The Details tab of the open account: its customers (not the person's, whose other accounts others can claim), its
 * sign-in name where it has no mailbox, and "Where this record comes from", which links the person's other accounts.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `readInlineData` and `useFragment` hand the node back: the fixture carries the nested fragments' fields flat.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
  useFragment: (_fragment: unknown, ref: unknown) => ref,
}));

import { routes } from '@/lib/routes';
import { UserDetailsTab } from './user-details-tab';

let container: HTMLDivElement;
let root: Root;

interface AccountShape {
  id: string;
  source?: string;
  email?: string | null;
  signInName?: string | null;
  connection?: string | null;
  customers?: string[];
}

function account({
  id,
  source = 'MICROSOFT_365',
  email = 'olivia@contoso.com',
  signInName = email,
  connection = 'Contoso',
  customers = ['Northbridge'],
}: AccountShape) {
  return {
    id,
    source,
    email,
    signInName,
    connection: connection ? { name: connection } : null,
    customers: customers.map(name => ({ organization: { organizationId: `org-${name}`, name, image: null } })),
    status: 'ACTIVE',
    statusReason: null,
    statusDetail: null,
    topAdmin: 'NO',
    secondFactor: 'ENROLLED',
    lastSignInAt: null,
    signInData: 'READ',
    directoryCreatedAt: null,
    phone: null,
    details: null,
  };
}

const render = (...accounts: ReturnType<typeof account>[]) =>
  act(() => root.render(<UserDetailsTab person={{ accounts } as never} />));

/** The value of the cell `label` names. */
function cell(label: string) {
  const labelEl = [...container.querySelectorAll('p')].find(p => p.textContent === label);
  return labelEl?.parentElement?.textContent?.replace(label, '');
}

describe('UserDetailsTab', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("names the customer of the open account only, not the person's other accounts'", () => {
    render(
      account({ id: 'g-1', source: 'GOOGLE_WORKSPACE', customers: ['Harbor'] }),
      account({ id: 'm-1', customers: ['Northbridge'] }),
    );
    expect(cell('Customer')).toContain('Harbor');
    expect(cell('Customer')).not.toContain('Northbridge');
  });

  it('shows the primary email of an account with a mailbox', () => {
    render(account({ id: 'm-1' }));
    expect(cell('Primary email')).toBe('olivia@contoso.com');
    expect(cell('Sign-in name')).toBeUndefined();
  });

  it('shows the sign-in name of an account with no mailbox', () => {
    render(account({ id: 'm-1', email: null, signInName: 'olivia@contoso.onmicrosoft.com' }));
    expect(cell('Sign-in name')).toBe('olivia@contoso.onmicrosoft.com');
    expect(cell('Primary email')).toBeUndefined();
  });

  it("links the person's other accounts from where the record comes from, and not the open one", () => {
    render(
      account({ id: 'm-1' }),
      account({ id: 'g-1', source: 'GOOGLE_WORKSPACE', email: 'olivia@contoso.org', connection: 'Contoso Google' }),
    );
    const links = [...container.querySelectorAll('a')].filter(link => link.getAttribute('href')?.includes('/users/'));
    // Named by where the account lives: the person's accounts often share one address.
    expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Google Workspace · Contoso Google', routes.users.details('g-1')],
    ]);
    expect(container.textContent).toContain('Microsoft 365 · Contoso');
    expect(container.textContent).toContain('olivia@contoso.com · This account');
    expect(container.textContent).toContain('olivia@contoso.org');
  });

  it('says a user added in OpenFrame comes from OpenFrame', () => {
    render(account({ id: 'o-1', source: 'OPENFRAME', connection: null, signInName: null }));
    expect(container.textContent).toContain('Added in OpenFrame');
    expect(container.textContent).toContain('olivia@contoso.com · This account');
  });
});
