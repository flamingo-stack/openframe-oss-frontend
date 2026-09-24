// Pins the Edit Tenant Integration contract: the form is seeded from the record, Save sends only
// the fields that changed (nothing at all when none did), the stored domain never blocks Save, and
// a refused or invalid save keeps the page with a toast.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryAccessState, DirectoryProvider, DirectorySyncStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import type { TenantConnection } from '../types/tenant-connection';
import { useEditTenantForm } from './use-edit-tenant-form';

const spies = vi.hoisted(() => ({
  router: { push: () => {}, replace: () => {}, back: () => {} },
  toast: vi.fn(),
  safeBack: vi.fn(),
  scroll: vi.fn(),
  update: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => spies.router }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

vi.mock('@/app/hooks/use-safe-back', () => ({ safeBackOrReplace: spies.safeBack, useSafeBack: () => vi.fn() }));

// The helper no-ops in jsdom (nothing has an offsetParent); mocked to assert the invalid path ran.
vi.mock('@/lib/scroll-to-first-invalid-field', () => ({ scrollToFirstInvalidField: spies.scroll }));

vi.mock('../services/tenant-connections-service', () => ({ tenantConnectionsService: { update: spies.update } }));

function connection(overrides: Partial<TenantConnection> = {}): TenantConnection {
  return {
    id: 'c-1',
    provider: DirectoryProvider.MICROSOFT_365,
    name: 'Contoso',
    domain: 'contoso.com',
    enabled: true,
    directoryId: null,
    grantedBy: null,
    connectedAt: null,
    lastSyncStatus: DirectorySyncStatus.NEVER,
    lastSyncAt: null,
    lastSyncError: null,
    organizationId: 'org-1',
    organization: { id: 'org-1', name: 'Contoso Ltd' },
    userCount: null,
    consentUrl: null,
    access: { state: DirectoryAccessState.DISCONNECTED, capabilities: [] },
    domains: [],
    ...overrides,
  };
}

// Recorded from an effect, after each commit, never during render.
const seen = { hook: null as ReturnType<typeof useEditTenantForm> | null };

function Probe({ record }: { record: TenantConnection | null }) {
  const result = useEditTenantForm(record);
  useEffect(() => {
    seen.hook = result;
  });
  return null;
}

function hook() {
  if (!seen.hook) throw new Error('the probe has not committed');
  return seen.hook;
}

let container: HTMLDivElement;
let root: Root;

function mount(record: TenantConnection | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe record={record} />
      </QueryClientProvider>,
    );
  });
}

function edit(name: 'name' | 'organizationId', value: string) {
  act(() => {
    hook().form.setValue(name, value, { shouldDirty: true });
  });
}

/** Save, then let the async resolver and the mutation settle. */
async function save() {
  await act(async () => {
    hook().handleSave();
    await new Promise(resolve => setTimeout(resolve, 20));
  });
}

describe('useEditTenantForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    seen.hook = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('seeds the form from the record on the first paint', () => {
    mount(connection());
    expect(hook().form.getValues()).toEqual({
      provider: DirectoryProvider.MICROSOFT_365,
      domain: 'contoso.com',
      name: 'Contoso',
      organizationId: 'org-1',
    });
  });

  it('writes nothing when nothing changed, then returns to the details page', async () => {
    mount(connection());
    await save();
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(spies.safeBack).toHaveBeenCalledWith(spies.router, routes.settings.tenantDetails('c-1'));
  });

  it('sends a rename alone', async () => {
    mount(connection());
    spies.update.mockResolvedValueOnce(connection({ name: 'Contoso EU' }));
    edit('name', 'Contoso EU');
    await save();
    expect(spies.update).toHaveBeenCalledWith('c-1', { name: 'Contoso EU' });
  });

  it('sends a customer move alone', async () => {
    mount(connection());
    spies.update.mockResolvedValueOnce(connection({ organizationId: 'org-2' }));
    edit('organizationId', 'org-2');
    await save();
    expect(spies.update).toHaveBeenCalledWith('c-1', { organizationId: 'org-2' });
  });

  it('saves a connection with no stored domain — Edit never sends one', async () => {
    mount(connection({ domain: null }));
    spies.update.mockResolvedValueOnce(connection({ name: 'Renamed' }));
    edit('name', 'Renamed');
    await save();
    expect(spies.update).toHaveBeenCalledWith('c-1', { name: 'Renamed' });
  });

  it("keeps the page and shows the backend's reason when the write is refused", async () => {
    mount(connection());
    spies.update.mockRejectedValueOnce(new Error('Directory connection not found: c-1'));
    edit('name', 'Renamed');
    await save();
    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'Directory connection not found: c-1' }),
    );
    expect(spies.safeBack).not.toHaveBeenCalled();
  });

  it('refuses an invalid form without a write', async () => {
    mount(connection());
    edit('name', '   ');
    await save();
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cannot save yet', variant: 'destructive' }),
    );
    expect(spies.scroll).toHaveBeenCalled();
  });
});
