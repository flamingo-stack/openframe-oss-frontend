// Pins the mock service's contract with the backend it stands in for
// (`directory-integrations.graphqls`): what the list matches on, what a fresh
// connection looks like, when the domain is frozen, what a probe changes. Each
// assertion was verified to fail with its rule reverted.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryAccessState, DirectoryProvider, DirectorySyncStatus } from '../types/directory-enums';
import {
  createMockTenantConnectionsService,
  DOMAIN_LOCKED_MESSAGE,
  type ITenantConnectionsService,
  MOCK_CHECK_LATENCY_MS,
  MOCK_LATENCY_MS,
  TenantConnectionNotFoundError,
} from './tenant-connections-service';

/** Awaits a service call under fake timers by draining the mock latency. */
async function settle<T>(promise: Promise<T>, latency = MOCK_LATENCY_MS): Promise<T> {
  // A rejection that lands while the timers drain must not surface as an
  // unhandled one — the caller awaits (or `expect(...).rejects`) the promise next.
  promise.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(latency + 50);
  return promise;
}

const newInput = (domain: string, provider: DirectoryProvider = DirectoryProvider.GOOGLE_WORKSPACE) => ({
  provider,
  domain,
  name: `Connection ${domain}`,
  organizationId: 'org-meridian',
});

describe('MockTenantConnectionsService', () => {
  let service: ITenantConnectionsService;

  beforeEach(() => {
    vi.useFakeTimers();
    // A fresh instance per test: `list()` assertions are order- and count-sensitive.
    service = createMockTenantConnectionsService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('seeds the eight Figma rows in display order', async () => {
    const rows = await settle(service.list());
    expect(rows.map(row => row.name)).toEqual([
      'Stonebridge Financial',
      'Brightline Manufacturing',
      'Calderon Dental Group',
      'Northwind Logistics',
      'Harbourpoint Legal',
      'Vellum Architecture',
      'Ashgrove Care Homes',
      'Quillfeather Media',
    ]);
  });

  it('takes the mock latency before answering', async () => {
    let settled = false;
    void service.list().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS - 50);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBe(true);
  });

  it('search matches the name, every domain and the customer name, case-insensitively and trimmed', async () => {
    expect((await settle(service.list({ search: '  STONE ' }))).map(r => r.id)).toEqual(['tc-01']);
    expect((await settle(service.list({ search: 'harbourpoint.legal' }))).map(r => r.id)).toEqual(['tc-05']);
    // A verified secondary domain, not the one entered at creation (brief / Figma #105).
    expect((await settle(service.list({ search: 'northwind-freight' }))).map(r => r.id)).toEqual(['tc-04']);
    expect((await settle(service.list({ search: 'calderon dental' }))).map(r => r.id)).toEqual(['tc-03']);
  });

  it('search with no hit answers an empty array', async () => {
    expect(await settle(service.list({ search: 'nothing-like-this' }))).toEqual([]);
  });

  it('narrows to one customer when asked', async () => {
    expect((await settle(service.list({ organizationId: 'org-northwind' }))).map(r => r.id)).toEqual(['tc-04']);
  });

  it('get answers the connection by id and null for an unknown id', async () => {
    expect((await settle(service.get('tc-04')))?.name).toBe('Northwind Logistics');
    expect(await settle(service.get('nope'))).toBeNull();
  });

  it('answers copies — mutating a result does not change the store', async () => {
    const row = await settle(service.get('tc-04'));
    if (!row) throw new Error('fixture tc-04 is missing');
    row.name = 'Edited locally';
    row.access.capabilities.length = 0;
    const again = await settle(service.get('tc-04'));
    expect(again?.name).toBe('Northwind Logistics');
    expect(again?.access.capabilities.length).toBeGreaterThan(0);
  });

  it('create persists a DISCONNECTED record with a consent link and a normalised domain', async () => {
    const created = await settle(service.create(newInput('  Flamingo.CX ')));
    expect(created.domain).toBe('flamingo.cx');
    expect(created.access.state).toBe(DirectoryAccessState.DISCONNECTED);
    expect(created.lastSyncStatus).toBe(DirectorySyncStatus.NEVER);
    expect(created.connectedAt).toBeNull();
    expect(created.consentUrl).toContain('flamingo.cx');
    expect((await settle(service.list())).map(r => r.id)).toContain(created.id);
  });

  it('create mints a Microsoft link too — the mock stands in for the Figma flow, not the app-registration backend (ASSUMPTIONS A1)', async () => {
    const created = await settle(service.create(newInput('contoso.com', DirectoryProvider.MICROSOFT_365)));
    expect(created.consentUrl).toContain('login.microsoftonline.com/contoso.com');
  });

  it('create rejects an unknown customer', async () => {
    await expect(settle(service.create({ ...newInput('x.com'), organizationId: 'org-ghost' }))).rejects.toThrow(
      /was not found/,
    );
  });

  it('update renames and moves a connection at any access state', async () => {
    const updated = await settle(service.update('tc-04', { name: ' Northwind EU ', organizationId: 'org-pinecrest' }));
    expect(updated.name).toBe('Northwind EU');
    expect(updated.organization.name).toBe('Pinecrest Veterinary');
  });

  it('update changes the domain only before the first consent, and voids the outstanding link', async () => {
    const created = await settle(service.create(newInput('before.example')));
    const moved = await settle(service.update(created.id, { domain: 'After.Example' }));
    expect(moved.domain).toBe('after.example');
    expect(moved.consentUrl).toBeNull();

    await expect(settle(service.update('tc-04', { domain: 'northwind.io' }))).rejects.toThrow(DOMAIN_LOCKED_MESSAGE);
  });

  it('startConsent mints a link that differs from the previous one', async () => {
    const created = await settle(service.create(newInput('mint.example')));
    const minted = await settle(service.startConsent(created.id));
    expect(minted.consentUrl).not.toBeNull();
    expect(minted.consentUrl).not.toBe(created.consentUrl);
  });

  it('check answers READ_ONLY for an unscripted connection and fills in the first read', async () => {
    const created = await settle(service.create(newInput('fresh.example')));
    const access = await settle(service.check(created.id), MOCK_CHECK_LATENCY_MS);
    expect(access.state).toBe(DirectoryAccessState.READ_ONLY);
    expect(access.capabilities).not.toHaveLength(0);

    const after = await settle(service.get(created.id));
    expect(after?.connectedAt).not.toBeNull();
    expect(after?.lastSyncStatus).toBe(DirectorySyncStatus.SUCCESS);
    expect(after?.lastSyncAt).not.toBeNull();
    expect(after?.userCount).toBeGreaterThan(0);
    expect(after?.grantedBy).toBe('admin@fresh.example');
    expect(after?.domains[0]).toMatchObject({ name: 'fresh.example', primary: true });
    // Consent granted — no link is outstanding any more.
    expect(after?.consentUrl).toBeNull();
  });

  it('check answers the scripted refusal for a seeded row once, then recovers on the next probe', async () => {
    expect((await settle(service.check('tc-01'), MOCK_CHECK_LATENCY_MS)).state).toBe(DirectoryAccessState.DISCONNECTED);
    expect((await settle(service.check('tc-02'), MOCK_CHECK_LATENCY_MS)).state).toBe(
      DirectoryAccessState.CONSENT_REVOKED,
    );
    const refused = await settle(service.get('tc-01'));
    expect(refused?.connectedAt).toBeNull();
    expect(refused?.userCount).toBeNull();

    // The refusal is spent: the seeded rows are not a dead end for the connected path.
    expect((await settle(service.check('tc-01'), MOCK_CHECK_LATENCY_MS)).state).toBe(DirectoryAccessState.READ_ONLY);
    const recovered = await settle(service.get('tc-01'));
    expect(recovered?.connectedAt).not.toBeNull();
    expect(recovered?.consentUrl).toBeNull();
  });

  it('check follows the QA domain suffixes: refused, revoked, transport error', async () => {
    const refused = await settle(service.create(newInput('acme.notauthorised.test')));
    expect((await settle(service.check(refused.id), MOCK_CHECK_LATENCY_MS)).state).toBe(
      DirectoryAccessState.NOT_AUTHORISED,
    );

    const revoked = await settle(service.create(newInput('acme.revoked.test')));
    expect((await settle(service.check(revoked.id), MOCK_CHECK_LATENCY_MS)).state).toBe(
      DirectoryAccessState.CONSENT_REVOKED,
    );

    const failing = await settle(service.create(newInput('acme.error.test')));
    await expect(settle(service.check(failing.id), MOCK_CHECK_LATENCY_MS)).rejects.toThrow(
      /provider returned an error/,
    );
  });

  it('check on an unknown id throws the typed not-found error', async () => {
    await expect(settle(service.check('nope'), MOCK_CHECK_LATENCY_MS)).rejects.toBeInstanceOf(
      TenantConnectionNotFoundError,
    );
  });

  it('lists the customers not yet bound to a connection, and the edited one on request', async () => {
    const page = await settle(service.listAvailableOrganizations({ first: 100 }));
    expect(page.items.map(o => o.name)).toEqual([
      'Meridian Trust',
      'Ashgrove Community Trust',
      'Vellum Interiors',
      'Pinecrest Veterinary',
    ]);
    expect(page.hasNextPage).toBe(false);

    const withOwn = await settle(
      service.listAvailableOrganizations({ first: 100, includeOrganizationId: 'org-northwind' }),
    );
    expect(withOwn.items.map(o => o.id)).toContain('org-northwind');
  });

  it('pages the customers by cursor', async () => {
    const first = await settle(service.listAvailableOrganizations({ first: 3 }));
    expect(first.items).toHaveLength(3);
    expect(first.hasNextPage).toBe(true);
    const second = await settle(service.listAvailableOrganizations({ first: 3, after: first.endCursor }));
    expect(second.items.map(o => o.name)).toEqual(['Pinecrest Veterinary']);
    expect(second.hasNextPage).toBe(false);
    expect(second.endCursor).toBeNull();
  });
});
