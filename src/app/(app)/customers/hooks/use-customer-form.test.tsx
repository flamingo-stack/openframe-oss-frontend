/**
 * Pins the customer form contract after the react-hook-form migration: the
 * edit form is seeded exactly once from the fetched record (mailing line
 * mirrored, every contact kept) and never over the user's edits; an invalid
 * submit toasts and sends nothing; a valid submit sends the same payload the
 * useState form sent and reports the outcome. Each assertion was verified to
 * fail with its guard removed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { useCustomerForm } from './use-customer-form';

const spies = vi.hoisted(() => ({
  replace: vi.fn(),
  toast: vi.fn(),
  scroll: vi.fn(),
  safeBack: vi.fn(),
  flush: vi.fn(async () => undefined),
  onInvalid: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: spies.replace, back: vi.fn() }),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

// The helper no-ops in jsdom (nothing has an offsetParent); mocked to assert the invalid path ran.
vi.mock('@/lib/scroll-to-first-invalid-field', () => ({ scrollToFirstInvalidField: spies.scroll }));

vi.mock('@/app/hooks/use-safe-back', () => ({ safeBackOrReplace: spies.safeBack, useSafeBack: () => vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: spies.post, put: spies.put, get: vi.fn() },
}));

const CONTACTS = [1, 2, 3, 4].map(index => ({
  contactName: `Contact ${index}`,
  title: `Title ${index}`,
  phone: `+1-555-000${index}`,
  email: `contact${index}@acme.com`,
}));

function record(name = 'TechFlow Solutions') {
  return {
    id: 'org-1',
    organizationId: 'org-1',
    name,
    category: 'Software',
    websiteUrl: 'techflow.com',
    notes: 'Enterprise client',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    contactInformation: {
      contacts: CONTACTS,
      physicalAddress: { street1: '1 Main St' },
      mailingAddress: null,
    },
  };
}

const COMMIT_CAP = 200;

// Recorded from an effect, after each commit, rather than during render: the
// hook rules forbid writing module state from the render body.
const seen = { commits: 0, hook: null as ReturnType<typeof useCustomerForm> | null };

function Harness({ organizationId, tick }: { organizationId: string | null; tick: number }) {
  const result = useCustomerForm({ organizationId, flushPendingLogo: spies.flush, onInvalid: spies.onInvalid });
  useEffect(() => {
    seen.hook = result;
    if (++seen.commits > COMMIT_CAP) throw new Error(`render loop: Harness committed more than ${COMMIT_CAP} times`);
  });
  return <span data-tick={tick} />;
}

function current() {
  if (!seen.hook) throw new Error('Harness has not rendered');
  return seen.hook;
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function settle(ms = 30) {
  await act(async () => {
    await sleep(ms);
  });
}

function render(organizationId: string | null, tick = 0) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness organizationId={organizationId} tick={tick} />
      </QueryClientProvider>,
    );
  });
}

async function save() {
  await act(async () => {
    current().handleSave();
    await sleep(50);
  });
}

const organizationRequests = () => spies.post.mock.calls.filter(([url]) => url === '/api/organizations');

beforeEach(() => {
  vi.clearAllMocks();
  seen.commits = 0;
  seen.hook = null;
  spies.post.mockImplementation(async (_url: string, body: { query?: string }) =>
    body?.query?.includes('organizationByOrganizationId')
      ? { ok: true, data: { data: { organizationByOrganizationId: record() } } }
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
});

describe('useCustomerForm in edit mode', () => {
  it('seeds the form once from the fetched record and then stops re-rendering', async () => {
    render('org-1');
    expect(current().customerLoaded).toBe(false);
    await settle();

    const { form } = current();
    expect(current().customerLoaded).toBe(true);
    expect(form.getValues('name')).toBe('TechFlow Solutions');
    expect(form.getValues('website')).toBe('techflow.com');
    expect(form.getValues('contacts')).toEqual(CONTACTS);
    // Mailing empty on the record → the checkbox is on and the mailing line shows the physical address.
    expect(form.getValues('mailingSameAsPhysical')).toBe(true);
    expect(form.getValues('mailingAddress')).toBe('1 Main St');

    const afterSeed = seen.commits;
    await settle(100);
    expect(seen.commits - afterSeed).toBeLessThan(5);
  }, 15_000);

  it('keeps the user edits when the record refreshes underneath', async () => {
    render('org-1');
    await settle();
    act(() => {
      current().form.setValue('name', 'Edited', { shouldDirty: true });
    });

    spies.post.mockImplementation(async () => ({
      ok: true,
      data: { data: { organizationByOrganizationId: record('Renamed on the server') } },
    }));
    await act(async () => {
      await client.invalidateQueries();
    });
    await settle();

    expect(current().form.getValues('name')).toBe('Edited');
  });

  it('sends the record back whole with the mailing line mirrored, then reports and navigates', async () => {
    render('org-1');
    await settle();
    act(() => {
      current().form.setValue('name', 'Edited');
      current().form.setValue('physicalAddress', '2 Elm St');
    });

    await save();

    expect(spies.put).toHaveBeenCalledTimes(1);
    const [url, payload] = spies.put.mock.calls[0];
    expect(url).toBe('/api/organizations/org-1');
    expect(payload).toMatchObject({
      name: 'Edited',
      category: 'Software',
      websiteUrl: 'techflow.com',
      notes: 'Enterprise client',
      contactInformation: {
        contacts: CONTACTS,
        physicalAddress: { street1: '2 Elm St' },
        mailingAddress: { street1: '2 Elm St' },
        mailingAddressSameAsPhysical: true,
      },
    });
    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Customer updated', description: 'Edited has been updated' }),
    );
    expect(spies.safeBack).toHaveBeenCalledWith(expect.anything(), routes.customers.details('org-1'));
    expect(current().isSubmitting).toBe(false);
  });

  it('reports a failed save and leaves the form as it was', async () => {
    spies.put.mockImplementation(async () => ({ ok: false, error: 'Name already in use.', status: 409 }));
    render('org-1');
    await settle();
    act(() => {
      current().form.setValue('name', 'Edited');
    });

    await save();

    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Save failed', description: 'Name already in use.', variant: 'destructive' }),
    );
    expect(spies.safeBack).not.toHaveBeenCalled();
    expect(current().form.getValues('name')).toBe('Edited');
    expect(current().isSubmitting).toBe(false);
  });
});

describe('useCustomerForm in create mode', () => {
  it('refuses an invalid submit: toast, scroll, nothing sent', async () => {
    render(null);
    await settle();
    expect(current().showErrors).toBe(false);

    await save();

    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cannot save yet',
        description: expect.stringContaining('Customer name is required'),
        variant: 'destructive',
      }),
    );
    expect(spies.scroll).toHaveBeenCalledTimes(1);
    expect(spies.onInvalid).toHaveBeenCalledTimes(1);
    expect(organizationRequests()).toHaveLength(0);
    expect(current().showErrors).toBe(true);
  });

  it('creates through POST, flushes the pending logo and returns to the list', async () => {
    render(null);
    await settle();
    act(() => {
      current().form.setValue('name', '  New Co  ');
    });

    await save();

    expect(organizationRequests()).toHaveLength(1);
    expect(organizationRequests()[0][1]).toMatchObject({
      name: 'New Co',
      numberOfEmployees: null,
      monthlyRevenue: null,
      contactInformation: { contacts: [], mailingAddressSameAsPhysical: true },
    });
    expect(spies.flush).toHaveBeenCalledWith('new-1');
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Customer created' }));
    expect(spies.replace).toHaveBeenCalledWith(routes.customers.list());
  });
});
