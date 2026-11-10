/**
 * Each of the Edit page's two forms diffs against the record it was seeded from. A refetch that lands on a dirty
 * customers form is not taken there, so it must not become the customers' baseline either: an untouched set would then
 * read as changed, and a rename would send the old customers over the ones just stored.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryProvider } from '@/generated/schema-enums';
import { ATTRIBUTION_MODE } from '../tenant-form/attribution.types';
import type { TenantFormRecord } from '../tenant-form/tenant-form-helpers';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('../tenant-form/use-save-integration', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSaveIntegration: () => ({ save, isSaving: false }),
}));

import { useEditTenantForm } from './use-edit-tenant-form';

/** A connection one customer owns whole. */
function tenantRecord(soleCustomerId: string): TenantFormRecord {
  return {
    id: 'conn-1',
    provider: DirectoryProvider.MICROSOFT_365,
    consentUrl: null,
    connected: true,
    values: { provider: DirectoryProvider.MICROSOFT_365, domain: 'contoso.com', name: 'Contoso' },
    attribution: { values: { mode: ATTRIBUTION_MODE.SOLE, soleCustomerId, customers: [] }, options: new Map() },
  };
}

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useEditTenantForm> | null;

function Harness({ stored }: { stored: TenantFormRecord }) {
  const edit = useEditTenantForm('conn-1', stored);
  useEffect(() => {
    hook = edit;
  });
  return null;
}

describe('useEditTenantForm, Save', () => {
  beforeEach(() => {
    hook = null;
    save.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('leaves the customers out when the form is back at the set it was seeded from', async () => {
    act(() => root.render(<Harness stored={tenantRecord('acme')} />));
    act(() => hook?.attributionForm.setValue('soleCustomerId', 'globex', { shouldDirty: true }));
    // Someone moved the tenant to Lab meanwhile: the dirty customers form keeps showing Acme.
    act(() => root.render(<Harness stored={tenantRecord('lab')} />));
    // The user undoes the change, and only renames.
    act(() => hook?.attributionForm.setValue('soleCustomerId', 'acme', { shouldDirty: true }));
    act(() => hook?.form.setValue('name', 'Contoso EU', { shouldDirty: true }));

    await act(async () => hook?.handleSave());
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toEqual({ name: 'Contoso EU' });
  });

  it('sends the customers the user changed', async () => {
    act(() => root.render(<Harness stored={tenantRecord('acme')} />));
    act(() => hook?.attributionForm.setValue('soleCustomerId', 'globex', { shouldDirty: true }));

    await act(async () => hook?.handleSave());
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({ customers: [{ organizationId: 'globex' }] });
  });
});
