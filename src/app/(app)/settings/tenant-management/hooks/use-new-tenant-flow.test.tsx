/**
 * Pins the New Tenant Integration state machine (`useNewTenantFlow`): one
 * record per Generate, Edit Domain re-runs as update + fresh link rather than a
 * second record, a probe answer that belongs to an earlier click or to an
 * unmounted page is dropped, Save writes only what changed and is refused while
 * a probe is running. Each assertion was verified to fail with its guard
 * removed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryProvider,
  DirectorySyncStatus,
} from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import type { TenantAccess, TenantConnection } from '../types/tenant-connection';
import type { TenantFormData } from '../types/tenant-form.types';
import { useNewTenantFlow } from './use-new-tenant-flow';

// `vi.mock` is hoisted above the imports, so the spies it closes over must be too.
const { replace, toast, service } = vi.hoisted(() => ({
  replace: vi.fn(),
  toast: vi.fn(),
  service: { create: vi.fn(), update: vi.fn(), startConsent: vi.fn(), check: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

vi.mock('../services/tenant-connections-service', () => ({
  tenantConnectionsService: service,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const VALUES: TenantFormData = {
  provider: DirectoryProvider.MICROSOFT_365,
  domain: 'flamingo.cx',
  name: 'Flamingo Team',
  organizationId: 'org-1',
};

function access(state: DirectoryAccessState): TenantAccess {
  return { state, capabilities: state === DirectoryAccessState.DISCONNECTED ? [] : [DirectoryCapability.USERS] };
}

function connection(overrides: Partial<TenantConnection> = {}): TenantConnection {
  return {
    id: 'tc-99',
    provider: VALUES.provider,
    name: VALUES.name,
    domain: VALUES.domain,
    enabled: true,
    directoryId: null,
    grantedBy: null,
    connectedAt: null,
    lastSyncStatus: DirectorySyncStatus.NEVER,
    lastSyncAt: null,
    lastSyncError: null,
    organizationId: VALUES.organizationId,
    organization: { id: VALUES.organizationId, name: 'Flamingo' },
    userCount: null,
    consentUrl: 'https://login.microsoftonline.com/flamingo.cx/adminconsent?nonce=1',
    access: access(DirectoryAccessState.DISCONNECTED),
    domains: [],
    ...overrides,
  };
}

const COMMIT_CAP = 200;

// Recorded from an effect, after each commit, never during render.
const seen = { commits: 0, hook: null as ReturnType<typeof useNewTenantFlow> | null };

function Probe() {
  const flow = useNewTenantFlow();
  useEffect(() => {
    seen.hook = flow;
    seen.commits += 1;
  });
  return null;
}

function hook() {
  if (!seen.hook) throw new Error('the probe has not committed');
  return seen.hook;
}

let container: HTMLDivElement;
let root: Root;

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
}

/** Kick async work off inside `act` and let its first microtasks run before asserting. */
async function start(work: () => void) {
  await act(async () => {
    work();
    await Promise.resolve();
  });
}

/** Generate with the service answering at once; lands in the link phase. */
async function generateAndLink(record = connection()) {
  service.create.mockResolvedValueOnce(record);
  await act(async () => {
    await hook().generate(VALUES);
  });
  expect(hook().phase).toBe('link');
}

describe('useNewTenantFlow', () => {
  beforeEach(() => {
    // Reset, not clear: a test that fails early must not hand its unconsumed `*Once` answers to the next.
    vi.resetAllMocks();
    seen.commits = 0;
    seen.hook = null;
    mount();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('starts filling with nothing locked and nothing to save', () => {
    const flow = hook();
    expect(flow.phase).toBe('filling');
    expect(flow.connection).toBeNull();
    expect(flow.providerLocked).toBe(false);
    expect(flow.domainLocked).toBe(false);
    expect(flow.canGenerate).toBe(true);
    expect(flow.canSave).toBe(false);
  });

  it('creates the record once on Generate and enters the link phase', async () => {
    const pending = deferred<TenantConnection>();
    service.create.mockReturnValueOnce(pending.promise);

    await start(() => {
      void hook().generate(VALUES);
      // The double click: same tick, same closure — must not start a second create.
      void hook().generate(VALUES);
    });
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.create).toHaveBeenCalledWith(VALUES);
    expect(hook().phase).toBe('generating');
    expect(hook().fieldsDisabled).toBe(true);
    expect(hook().canSave).toBe(false);

    await act(async () => {
      pending.resolve(connection());
      await pending.promise;
    });
    const flow = hook();
    expect(flow.phase).toBe('link');
    expect(flow.connection?.id).toBe('tc-99');
    expect(flow.providerLocked).toBe(true);
    expect(flow.domainLocked).toBe(true);
    expect(flow.canGenerate).toBe(false);
    expect(flow.canSave).toBe(true);
    expect(flow.editDomain).toBeTypeOf('function');
  });

  it('retries the link once when create persisted the record but could not mint one', async () => {
    const minted = connection({ consentUrl: 'https://login.microsoftonline.com/flamingo.cx/adminconsent?nonce=2' });
    service.startConsent.mockResolvedValueOnce(minted);
    await generateAndLink(connection({ consentUrl: null }));
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.startConsent).toHaveBeenCalledWith('tc-99');
    expect(hook().connection?.consentUrl).toBe(minted.consentUrl);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }));
  });

  it('keeps the created record and says so when the retry fails too — never a second create', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const failure = new Error('Provider unreachable');
    service.startConsent.mockRejectedValueOnce(failure);
    await generateAndLink(connection({ consentUrl: null }));
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(hook().connection?.id).toBe('tc-99');
    expect(hook().canSave).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning', title: 'No consent link yet' }));
    // The fallback keeps the record, but the retry's failure still leaves a trace.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tenant-management]'), failure);
  });

  it('Edit Domain with the domain unchanged mints a new link without resending the domain', async () => {
    await generateAndLink();
    act(() => {
      hook().editDomain?.();
    });
    service.update.mockResolvedValueOnce(connection());
    service.startConsent.mockResolvedValueOnce(connection());
    await act(async () => {
      await hook().generate(VALUES);
    });
    // The API refuses any domain once the admin consented — possibly outside this page — so
    // the key must be absent, not undefined (`toHaveBeenCalledWith` would accept either).
    expect(service.update).toHaveBeenCalledWith('tc-99', { name: VALUES.name, organizationId: VALUES.organizationId });
    expect(service.update.mock.calls[0][1]).not.toHaveProperty('domain');
    expect(hook().phase).toBe('link');
  });

  it('returns to filling with a toast when the create fails, keeping nothing locked', async () => {
    service.create.mockRejectedValueOnce(new Error('Customer "org-1" was not found.'));
    await act(async () => {
      await hook().generate(VALUES);
    });
    const flow = hook();
    expect(flow.phase).toBe('filling');
    expect(flow.connection).toBeNull();
    expect(flow.providerLocked).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'Customer "org-1" was not found.' }),
    );
  });

  it('locks Save while the probe runs and unlocks it on a readable answer', async () => {
    await generateAndLink();
    const pending = deferred<TenantAccess>();
    service.check.mockReturnValueOnce(pending.promise);

    await start(() => {
      void hook().consent.check();
    });
    expect(service.check).toHaveBeenCalledWith('tc-99');
    expect(hook().consent.status).toBe('checking');
    expect(hook().canSave).toBe(false);

    await act(async () => {
      pending.resolve(access(DirectoryAccessState.READ_ONLY));
      await pending.promise;
    });
    const flow = hook();
    expect(flow.consent.status).toBe('connected');
    expect(flow.canSave).toBe(true);
    // The directory granted for this domain — the backend refuses to move it now.
    expect(flow.editDomain).toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
  });

  it('reports a refused probe and a transport failure as failed, and lets the user try again', async () => {
    await generateAndLink();

    service.check.mockResolvedValueOnce(access(DirectoryAccessState.DISCONNECTED));
    await act(async () => {
      await hook().consent.check();
    });
    expect(hook().consent.status).toBe('failed');
    expect(hook().consent.result?.state).toBe(DirectoryAccessState.DISCONNECTED);
    expect(hook().canSave).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Connection check failed' }));

    service.check.mockRejectedValueOnce(new Error('The provider returned an error.'));
    await act(async () => {
      await hook().consent.check();
    });
    expect(hook().consent.status).toBe('failed');
    expect(hook().consent.result).toBeNull();
    expect(hook().consent.error).toBe('The provider returned an error.');

    service.check.mockResolvedValueOnce(access(DirectoryAccessState.READ_ONLY));
    await act(async () => {
      await hook().consent.check();
    });
    expect(hook().consent.status).toBe('connected');
  });

  it('Edit Domain forgets a pending probe, and the next Generate updates the record instead of creating another', async () => {
    await generateAndLink();
    const pending = deferred<TenantAccess>();
    service.check.mockReturnValueOnce(pending.promise);
    await start(() => {
      void hook().consent.check();
    });

    act(() => {
      hook().editDomain?.();
    });
    expect(hook().phase).toBe('filling');
    expect(hook().domainLocked).toBe(false);
    expect(hook().providerLocked).toBe(true);
    expect(hook().consent.status).toBe('idle');

    // The stale answer lands after the reset — it belongs to a link that no longer exists.
    await act(async () => {
      pending.resolve(access(DirectoryAccessState.READ_ONLY));
      await pending.promise;
    });
    expect(hook().consent.status).toBe('idle');

    const moved = connection({ domain: 'flamingo.dev', consentUrl: null });
    const relinked = connection({
      domain: 'flamingo.dev',
      consentUrl: 'https://login.microsoftonline.com/flamingo.dev/adminconsent?nonce=2',
    });
    service.update.mockResolvedValueOnce(moved);
    service.startConsent.mockResolvedValueOnce(relinked);
    await act(async () => {
      await hook().generate({ ...VALUES, domain: 'flamingo.dev' });
    });
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.update).toHaveBeenCalledWith('tc-99', {
      domain: 'flamingo.dev',
      name: VALUES.name,
      organizationId: VALUES.organizationId,
    });
    expect(service.startConsent).toHaveBeenCalledWith('tc-99');
    expect(hook().phase).toBe('link');
    expect(hook().connection?.consentUrl).toBe(relinked.consentUrl);
  });

  it('Save writes only what changed and replaces the page with the details route', async () => {
    await generateAndLink();

    await act(async () => {
      await hook().save(VALUES);
    });
    expect(service.update).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(routes.settings.tenantDetails('tc-99'));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('Save sends the renamed connection and the new customer', async () => {
    await generateAndLink();
    const renamed = connection({ name: 'Flamingo HQ', organizationId: 'org-2' });
    service.update.mockResolvedValueOnce(renamed);

    await act(async () => {
      await hook().save({ ...VALUES, name: 'Flamingo HQ', organizationId: 'org-2' });
    });
    expect(service.update).toHaveBeenCalledWith('tc-99', { name: 'Flamingo HQ', organizationId: 'org-2' });
    expect(replace).toHaveBeenCalledWith(routes.settings.tenantDetails('tc-99'));
  });

  it('Save is refused while a probe is running and before a link exists', async () => {
    await act(async () => {
      await hook().save(VALUES);
    });
    expect(replace).not.toHaveBeenCalled();

    await generateAndLink();
    const pending = deferred<TenantAccess>();
    service.check.mockReturnValueOnce(pending.promise);
    await start(() => {
      void hook().consent.check();
    });
    await act(async () => {
      await hook().save(VALUES);
    });
    expect(service.update).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve(access(DirectoryAccessState.READ_ONLY));
      await pending.promise;
    });
  });

  it('keeps the form usable after a failed Save', async () => {
    await generateAndLink();
    service.update.mockRejectedValueOnce(new Error('Name already in use.'));
    await act(async () => {
      await hook().save({ ...VALUES, name: 'Taken' });
    });
    expect(replace).not.toHaveBeenCalled();
    expect(hook().isSaving).toBe(false);
    expect(hook().canSave).toBe(true);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'Name already in use.' }),
    );
  });

  it('drops a probe answer that lands after the page unmounted', async () => {
    await generateAndLink();
    const pending = deferred<TenantAccess>();
    service.check.mockReturnValueOnce(pending.promise);
    await start(() => {
      void hook().consent.check();
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => root.unmount());
    await act(async () => {
      pending.resolve(access(DirectoryAccessState.READ_ONLY));
      await pending.promise;
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    // `afterEach` unmounts again; a second unmount of an unmounted root is a no-op.
    expect(toast).not.toHaveBeenCalled();
  });

  it('stays well under the commit cap through a whole flow', async () => {
    await generateAndLink();
    service.check.mockResolvedValueOnce(access(DirectoryAccessState.READ_ONLY));
    await act(async () => {
      await hook().consent.check();
    });
    await act(async () => {
      await hook().save(VALUES);
    });
    expect(seen.commits).toBeLessThan(COMMIT_CAP);
  });
});
