/**
 * Smoke test of the customer create/edit page after the react-hook-form
 * migration, in oss-tenant mode (flat form, no tabs, no logo uploader): the
 * real form renders on first paint and waits, locked, for the record; the
 * seeded values reach the inputs; typing reaches the form; the mailing line
 * mirrors the physical one; an invalid Save toasts and sends nothing; a valid
 * Save sends the record. Each assertion was verified to fail with its guard
 * removed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { NewCustomerPage } from './new-customer-page';

const spies = vi.hoisted(() => ({
  replace: vi.fn(),
  toast: vi.fn(),
  safeBack: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: spies.replace, back: vi.fn() }),
  usePathname: () => '/customers/edit',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

vi.mock('@/app/hooks/use-safe-back', () => ({ safeBackOrReplace: spies.safeBack, useSafeBack: () => vi.fn() }));

vi.mock('@/lib/upload-with-auth', () => ({ uploadWithAuth: vi.fn(), deleteWithAuth: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: spies.post, put: spies.put, get: vi.fn() },
}));

// The lib measures text for truncation tooltips and reads viewport queries; jsdom has neither.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const RECORD = {
  id: 'org-1',
  organizationId: 'org-1',
  name: 'TechFlow Solutions',
  websiteUrl: 'techflow.com',
  notes: 'Enterprise client',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  contactInformation: {
    contacts: [{ contactName: 'Jane Doe', title: 'IT Manager', phone: '+1-555-0123', email: 'jane@acme.com' }],
    physicalAddress: { street1: '1 Main St' },
    mailingAddress: null,
  },
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function settle(ms = 30) {
  await act(async () => {
    await sleep(ms);
  });
}

function render(organizationId: string | null) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <NewCustomerPage organizationId={organizationId} />
      </QueryClientProvider>,
    );
  });
}

const input = (placeholder: string) => {
  const element = container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`);
  if (!element) throw new Error(`No input with placeholder ${placeholder}`);
  return element;
};

const saveButton = () => {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Save Customer');
  if (!button) throw new Error('Save button not rendered');
  return button;
};

// React listens to the native `input` event; the value setter must be the prototype's, not React's tracked one.
function type(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickSave() {
  await act(async () => {
    saveButton().click();
    await sleep(50);
  });
}

const organizationRequests = () => spies.post.mock.calls.filter(([url]) => url === '/api/organizations');

beforeEach(() => {
  vi.clearAllMocks();
  window.__ENV = { NEXT_PUBLIC_APP_MODE: 'oss-tenant' } as unknown as typeof window.__ENV;
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })) as unknown as typeof window.matchMedia;
  spies.post.mockImplementation(async (_url: string, body: { query?: string }) =>
    body?.query?.includes('organizationByOrganizationId')
      ? { ok: true, data: { data: { organizationByOrganizationId: RECORD } } }
      : { ok: true, data: { organizationId: 'new-1' } },
  );
  spies.put.mockImplementation(async () => ({ ok: true, data: {} }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  client.clear();
  window.__ENV = {} as unknown as typeof window.__ENV;
});

describe('NewCustomerPage (edit)', () => {
  it('renders the locked form first, then the seeded values, then unlocks Save', async () => {
    render('org-1');
    expect(input('Customer Name').disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);

    await settle();

    expect(input('Customer Name').value).toBe('TechFlow Solutions');
    expect(input('Customer Name').disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);
  });

  it('mirrors the physical address into the disabled mailing line while the box is on', async () => {
    render('org-1');
    await settle();
    const mailing = () => input('123 Main St, City, State, ZIP');
    const physical = container.querySelectorAll<HTMLInputElement>(
      'input[placeholder="123 Main St, City, State, ZIP"]',
    )[0];

    expect(mailing().value).toBe('1 Main St');
    type(physical, '2 Elm St');

    const mailingInput = container.querySelectorAll<HTMLInputElement>(
      'input[placeholder="123 Main St, City, State, ZIP"]',
    )[1];
    expect(mailingInput.value).toBe('2 Elm St');
    expect(mailingInput.disabled).toBe(true);
  });

  it('saves what was typed and hands the whole contact list back', async () => {
    render('org-1');
    await settle();
    type(input('Customer Name'), 'Edited');

    await clickSave();

    expect(spies.put).toHaveBeenCalledTimes(1);
    expect(spies.put.mock.calls[0][1]).toMatchObject({
      name: 'Edited',
      contactInformation: { contacts: RECORD.contactInformation.contacts },
    });
    expect(spies.safeBack).toHaveBeenCalledWith(expect.anything(), routes.customers.details('org-1'));
  });
});

describe('NewCustomerPage (create)', () => {
  it('lets the user type straight away and refuses an empty name with a toast', async () => {
    render(null);
    await settle();
    expect(input('Customer Name').disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);

    await clickSave();

    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cannot save yet',
        description: expect.stringContaining('Customer name is required'),
      }),
    );
    expect(container.querySelector('[data-invalid]')).not.toBeNull();
    expect(organizationRequests()).toHaveLength(0);
  });
});
