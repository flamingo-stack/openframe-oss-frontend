/**
 * Pins the service guards: business `organizationId` rather than the Relay node id, paging until
 * `hasNextPage` or the cap, `userErrors` rejecting, Relay's error wrapper stripped, and `get`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  tenantConnectionsService_connection$data as WireConnection,
  tenantConnectionsService_connection$key as ConnectionKey,
} from '@/__generated__/tenantConnectionsService_connection.graphql';
import {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryProvider,
  DirectorySyncStatus,
} from '@/generated/schema-enums';
import { OfflineError } from '@/lib/query-state';
import {
  readConnection,
  TENANT_CONNECTIONS_PAGE_SIZE,
  TENANT_ORGANIZATIONS_CAP,
  TenantConnectionError,
  TenantConnectionsApiService,
} from './tenant-connections-service';

type MutationConfig = {
  variables: Record<string, unknown>;
  onCompleted: (response: unknown, errors: ReadonlyArray<{ message: string }> | null) => void;
  onError: (error: Error) => void;
};

const relay = vi.hoisted(() => ({ commitMutation: vi.fn(), fetchQuery: vi.fn() }));

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  commitMutation: relay.commitMutation,
  fetchQuery: relay.fetchQuery,
}));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
// `@inline` fragments are read with `readInlineData`; the wire objects below stand in for the ref.
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const ORG_BUSINESS_ID = 'e5f88c7c-37de-4cbf-a7f2-b0f7535463f4';

/** A `DirectoryConnection` as the feature env answered it (2026-09-24), trimmed to one row. */
const wire = (overrides: Record<string, unknown> = {}): WireConnection =>
  ({
    id: '6ab267b728a1dd239f65d8b5',
    provider: DirectoryProvider.MICROSOFT_365,
    name: 'andrii-test-microdosft',
    domain: 'testopenframe.onmicrosoft.com',
    enabled: true,
    directoryId: '0f6c0e7e-0000-0000-0000-000000000000',
    grantedBy: null,
    connectedAt: null,
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: '2026-09-23T22:08:05.199Z',
    lastSyncError: null,
    organizationId: ORG_BUSINESS_ID,
    organization: { organizationId: ORG_BUSINESS_ID, name: 'Directory Test Org', image: null },
    userCount: 12,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.WRITE_ENABLED,
      capabilities: [DirectoryCapability.USERS, DirectoryCapability.GROUPS],
    },
    domains: [{ name: 'testopenframe.onmicrosoft.com', primary: true, verified: true }],
    ...overrides,
  }) as unknown as WireConnection;

/** `fetchQuery(...).toPromise()` answering with the given data per call. */
function answerQueries(...responses: unknown[]) {
  const queue = [...responses];
  relay.fetchQuery.mockImplementation(() => ({ toPromise: () => Promise.resolve(queue.shift()) }));
}

function answerMutation(response: unknown, errors: ReadonlyArray<{ message: string }> | null = null) {
  relay.commitMutation.mockImplementation((_env: unknown, config: MutationConfig) => {
    config.onCompleted(response, errors);
    return { dispose: () => {} };
  });
}

function failMutation(error: Error) {
  relay.commitMutation.mockImplementation((_env: unknown, config: MutationConfig) => {
    config.onError(error);
    return { dispose: () => {} };
  });
}

const page = (nodes: WireConnection[], endCursor: string | null, hasNextPage: boolean) => ({
  directoryConnections: { edges: nodes.map(node => ({ node })), pageInfo: { hasNextPage, endCursor } },
});

const organizationsPage = (count: number, endCursor: string | null, hasNextPage: boolean, offset = 0) => ({
  directoryConnectionOrganizations: {
    edges: Array.from({ length: count }, (_, index) => ({
      node: { organizationId: `org-${offset + index}`, name: `Customer ${offset + index}`, image: null },
    })),
    pageInfo: { hasNextPage, endCursor },
  },
});

/** What relay-runtime throws when an operation answers with errors and no data. */
function relayNoDataError(operation: string, message: string) {
  return Object.assign(
    new Error(
      `No data returned for operation \`${operation}\`, got error(s):\n${message}\n\nSee the error \`source\` property for more information.`,
    ),
    { source: { errors: [{ message }] } },
  );
}

const service = new TenantConnectionsApiService();

/** `readInlineData` is mocked to hand back its ref, so the wire object stands in for every step's key. */
const fromWire = (data: WireConnection) => readConnection(data as unknown as ConnectionKey);

beforeEach(() => {
  relay.commitMutation.mockReset();
  relay.fetchQuery.mockReset();
});

describe('readConnection (the ladder, read in one go)', () => {
  it('keys the customer by its business organizationId — what the API takes back — not the Relay node id', () => {
    const connection = fromWire(wire());
    expect(connection.organization.id).toBe(ORG_BUSINESS_ID);
    expect(connection.organization.id).toBe(connection.organizationId);
  });

  it('carries the customer logo with its cache-busting hash', () => {
    const connection = fromWire(
      wire({
        organization: {
          organizationId: ORG_BUSINESS_ID,
          name: 'Directory Test Org',
          image: { imageUrl: '/api/organizations/logo.png', hash: 'abc123' },
        },
      }),
    );
    expect(connection.organization).toMatchObject({ imageUrl: '/api/organizations/logo.png', imageHash: 'abc123' });
  });

  it('keeps a missing domain null (a Microsoft 365 connection created from a GUID) instead of inventing one', () => {
    expect(fromWire(wire({ domain: null })).domain).toBeNull();
  });

  it('passes an ISO instant through and treats anything else in the untyped scalar as absent', () => {
    expect(fromWire(wire()).lastSyncAt).toBe('2026-09-23T22:08:05.199Z');
    expect(fromWire(wire({ lastSyncAt: 1790000000 })).lastSyncAt).toBeNull();
    expect(fromWire(wire({ connectedAt: '' })).connectedAt).toBeNull();
  });

  it('passes an access state this build does not know through, for the presentation layer to show raw', () => {
    const connection = fromWire(wire({ access: { state: 'SUSPENDED', capabilities: [] } }));
    expect(connection.access.state).toBe('SUSPENDED');
  });
});

describe('list', () => {
  it('pages until hasNextPage is false, at the backend page ceiling, carrying the cursor forward', async () => {
    answerQueries(page([wire({ id: 'a' })], 'c1', true), page([wire({ id: 'b' })], 'c2', false));
    const rows = await service.list();
    expect(rows.map(row => row.id)).toEqual(['a', 'b']);
    expect(relay.fetchQuery).toHaveBeenCalledTimes(2);
    expect(relay.fetchQuery.mock.calls[0][2]).toEqual({
      search: null,
      limit: TENANT_CONNECTIONS_PAGE_SIZE,
      cursor: null,
    });
    expect(relay.fetchQuery.mock.calls[1][2]).toMatchObject({ cursor: 'c1' });
  });

  it('trims the search and sends a blank one as no filter', async () => {
    answerQueries(page([], null, false), page([], null, false));
    await service.list({ search: '  contoso ' });
    await service.list({ search: '   ' });
    expect(relay.fetchQuery.mock.calls[0][2]).toMatchObject({ search: 'contoso' });
    expect(relay.fetchQuery.mock.calls[1][2]).toMatchObject({ search: null });
  });

  it('narrows by customer on the client — the API has no organization filter', async () => {
    answerQueries(page([wire({ id: 'a' }), wire({ id: 'b', organizationId: 'other-org' })], null, false));
    const rows = await service.list({ organizationId: ORG_BUSINESS_ID });
    expect(rows.map(row => row.id)).toEqual(['a']);
  });

  it("rejects with the backend's message, not Relay's no-data wrapper", async () => {
    relay.fetchQuery.mockImplementation(() => ({
      toPromise: () => Promise.reject(relayNoDataError('tenantConnectionsServiceListQuery', 'Access Denied')),
    }));
    await expect(service.list()).rejects.toThrow(/^Access Denied$/);
  });

  it('keeps an offline failure as the offline error the UI recognises', async () => {
    const offline = new OfflineError('tenantConnectionsServiceListQuery');
    relay.fetchQuery.mockImplementation(() => ({ toPromise: () => Promise.reject(offline) }));
    await expect(service.list()).rejects.toBe(offline);
  });
});

describe('get', () => {
  it('finds the record in a probe-free scan, then reads only rows matching its name with the full step', async () => {
    answerQueries(
      page([wire({ id: 'a', name: 'Alpha' })], 'c1', true),
      page([wire({ id: 'b', name: 'Bravo' })], null, false),
      page([wire({ id: 'b', name: 'Bravo' })], null, false),
    );
    expect((await service.get('b'))?.id).toBe('b');
    expect(relay.fetchQuery).toHaveBeenCalledTimes(3);
    expect(relay.fetchQuery.mock.calls[0][2]).toEqual({ limit: TENANT_CONNECTIONS_PAGE_SIZE, cursor: null });
    expect(relay.fetchQuery.mock.calls[2][2]).toMatchObject({ search: 'Bravo', cursor: null });
  });

  it('stops scanning once the id is found', async () => {
    answerQueries(page([wire({ id: 'a' })], 'c1', true), page([wire({ id: 'a' })], null, false));
    await service.get('a');
    expect(relay.fetchQuery).toHaveBeenCalledTimes(2);
  });

  it('answers null for an unknown id without the probing query (the not-found branch)', async () => {
    answerQueries(page([wire({ id: 'a' })], null, false));
    expect(await service.get('missing')).toBeNull();
    expect(relay.fetchQuery).toHaveBeenCalledTimes(1);
  });

  it('falls back to an unfiltered read when the name search does not return the row', async () => {
    answerQueries(
      page([wire({ id: 'b', name: 'Bravo' })], null, false),
      page([wire({ id: 'other', name: 'Bravo Two' })], null, false),
      page([wire({ id: 'b', name: 'Bravo' })], null, false),
    );
    expect((await service.get('b'))?.id).toBe('b');
    expect(relay.fetchQuery.mock.calls[2][2]).toMatchObject({ search: null });
  });
});

describe('getOptions', () => {
  it('drops a provider this build cannot send back as an input', async () => {
    answerQueries({
      directoryConnectionOptions: {
        providers: [DirectoryProvider.GOOGLE_WORKSPACE, DirectoryProvider.MICROSOFT_365, 'OKTA'],
      },
    });
    expect((await service.getOptions()).providers).toEqual([
      DirectoryProvider.GOOGLE_WORKSPACE,
      DirectoryProvider.MICROSOFT_365,
    ]);
  });
});

describe('listAvailableOrganizations', () => {
  it('maps each customer to its business id, the value the create/update inputs take, across every page', async () => {
    answerQueries(organizationsPage(1, 'o1', true), organizationsPage(1, null, false, 1));
    expect(await service.listAvailableOrganizations()).toEqual([
      { id: 'org-0', name: 'Customer 0', imageUrl: null, imageHash: null },
      { id: 'org-1', name: 'Customer 1', imageUrl: null, imageHash: null },
    ]);
    expect(relay.fetchQuery.mock.calls[0][2]).toEqual({ first: TENANT_CONNECTIONS_PAGE_SIZE, after: null });
    expect(relay.fetchQuery.mock.calls[1][2]).toEqual({ first: TENANT_CONNECTIONS_PAGE_SIZE, after: 'o1' });
  });

  it('stops at the cap — the point where the search-less picker needs a search box', async () => {
    const pages = TENANT_ORGANIZATIONS_CAP / TENANT_CONNECTIONS_PAGE_SIZE;
    answerQueries(
      ...Array.from({ length: pages + 1 }, (_, index) =>
        organizationsPage(TENANT_CONNECTIONS_PAGE_SIZE, `o${index}`, true, index * TENANT_CONNECTIONS_PAGE_SIZE),
      ),
    );
    expect(await service.listAvailableOrganizations()).toHaveLength(TENANT_ORGANIZATIONS_CAP);
    expect(relay.fetchQuery).toHaveBeenCalledTimes(pages);
  });
});

describe('mutations', () => {
  const INPUT = {
    provider: DirectoryProvider.MICROSOFT_365,
    domain: 'contoso.com',
    name: 'Contoso',
    organizationId: 'org-1',
  };

  it('create resolves the connection the payload carries', async () => {
    answerMutation({ createDirectoryConnection: { connection: wire({ id: 'new' }), userErrors: [] } });
    expect((await service.create(INPUT)).id).toBe('new');
    expect((relay.commitMutation.mock.calls[0][1] as MutationConfig).variables).toEqual({ input: INPUT });
  });

  it('a userErrors answer rejects with the backend message — it is a refusal, not an empty success', async () => {
    answerMutation({
      updateDirectoryConnection: {
        connection: null,
        userErrors: [{ code: 'DIRECTORY_CONNECTION_ERROR', message: 'Directory connection not found: x' }],
      },
    });
    const promise = service.update('x', { name: 'Renamed' });
    await expect(promise).rejects.toBeInstanceOf(TenantConnectionError);
    await expect(promise).rejects.toThrow('Directory connection not found: x');
  });

  it('a payload with neither a connection nor an error rejects with the fallback message', async () => {
    answerMutation({ startDirectoryConsent: { connection: null, userErrors: [] } });
    await expect(service.startConsent('x')).rejects.toThrow('Could not create a consent link');
  });

  it('GraphQL-level errors reject', async () => {
    answerMutation(null, [{ message: 'Access Denied' }]);
    await expect(service.create(INPUT)).rejects.toThrow('Access Denied');
  });

  it("a failed mutation rejects with the backend's message, not Relay's no-data wrapper", async () => {
    failMutation(relayNoDataError('tenantConnectionsServiceCreateMutation', 'Access Denied'));
    await expect(service.create(INPUT)).rejects.toThrow(/^Access Denied$/);
  });

  it('check resolves an unreachable provider as its state — the caller shows it, nothing threw', async () => {
    answerMutation({
      checkDirectoryConnection: {
        connection: { access: { state: DirectoryAccessState.DISCONNECTED, capabilities: [] } },
        userErrors: [],
      },
    });
    await expect(service.check('fake')).resolves.toEqual({
      state: DirectoryAccessState.DISCONNECTED,
      capabilities: [],
    });
  });
});
