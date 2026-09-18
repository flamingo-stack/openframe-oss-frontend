// Tenant connections service (CU-86akj8ajt).
//
// Backs the Tenant Management UI while the directory backend (branch
// `feature/directory-fe-integration`, schema `directory-integrations.graphqls`)
// is unmerged: one method per GraphQL operation, the same argument and result
// shapes, the same rules (a connection exists from the moment its first consent
// link is minted; the domain is editable only until the first successful
// consent; a probe is the only thing that changes the access state). Swapping to
// the real API is one new implementation of `ITenantConnectionsService` — the
// hooks and every component import only the interface-typed singleton.

import {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryProvider,
  DirectorySyncStatus,
} from '../types/directory-enums';
import type {
  CreateTenantConnectionInput,
  TenantAccess,
  TenantConnection,
  TenantConnectionsFilter,
  TenantOrganization,
  TenantOrganizationsPage,
  TenantOrganizationsPageInput,
  UpdateTenantConnectionInput,
} from '../types/tenant-connection';
import {
  TENANT_CHECK_OUTCOME_FIXTURES,
  TENANT_CONNECTION_FIXTURES,
  TENANT_ORGANIZATION_FIXTURES,
} from './tenant-connections-fixtures';

export interface ITenantConnectionsService {
  /** `directoryConnections(filter:)` — the whole list, no paging; `search` matches name, domain and customer name. */
  list(filter?: TenantConnectionsFilter): Promise<TenantConnection[]>;
  /** One connection, or `null` when the id is unknown (the details page's not-found branch). */
  get(id: string): Promise<TenantConnection | null>;
  /** `directoryConnectionOptions` — the providers this deployment offers. */
  getOptions(): Promise<{ providers: DirectoryProvider[] }>;
  /** `directoryConnectionOrganizations(first, after)` — customers not yet bound to a connection, paged. */
  listAvailableOrganizations(input: TenantOrganizationsPageInput): Promise<TenantOrganizationsPage>;
  /** `createDirectoryConnection` — persists a DISCONNECTED record and mints its first consent link. */
  create(input: CreateTenantConnectionInput): Promise<TenantConnection>;
  /** `updateDirectoryConnection` — rename / move / correct the domain (domain only before the first consent). */
  update(id: string, input: UpdateTenantConnectionInput): Promise<TenantConnection>;
  /** `startDirectoryConsent` — mints a fresh consent link, replacing any outstanding one. */
  startConsent(id: string): Promise<TenantConnection>;
  /** `checkDirectoryConnection` — probes the provider now and reports the resulting access state. */
  check(id: string): Promise<TenantAccess>;
}

export class TenantConnectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Tenant connection "${id}" was not found.`);
    this.name = 'TenantConnectionNotFoundError';
  }
}

/** Mirrors the contract: `updateDirectoryConnection` answers a userError once `connectedAt` is set. */
export const DOMAIN_LOCKED_MESSAGE = 'The domain cannot be changed after consent has been granted.';

export const MOCK_LATENCY_MS = 250;
/** Long enough for the "Check Connection" loading state to be seen. */
export const MOCK_CHECK_LATENCY_MS = 1500;
const MOCK_SLOW_CHECK_LATENCY_MS = 4000;

/**
 * QA levers that need no UI: a domain ending in one of these makes the mock's
 * probe answer the matching outcome instead of the default READ_ONLY — every
 * time, for as long as the domain carries the suffix. `*.error.test` rejects (a
 * transport failure), `*.slow.test` keeps the loading state up for a few seconds.
 *
 * The seeded not-connected rows (Stonebridge, Brightline) are different: their
 * scripted refusal is spent on the FIRST probe, so a screen can show the failure
 * and then, on the next "Check Connection", the recovery — as if the customer's
 * admin had consented in between. Nothing in the fixtures is a dead end.
 */
export const MOCK_DOMAIN_OUTCOMES = {
  '.notauthorised.test': DirectoryAccessState.NOT_AUTHORISED,
  '.revoked.test': DirectoryAccessState.CONSENT_REVOKED,
  '.disconnected.test': DirectoryAccessState.DISCONNECTED,
  '.writeavailable.test': DirectoryAccessState.WRITE_AVAILABLE,
  '.writeenabled.test': DirectoryAccessState.WRITE_ENABLED,
} as const;
export const MOCK_ERROR_DOMAIN_SUFFIX = '.error.test';
export const MOCK_SLOW_DOMAIN_SUFFIX = '.slow.test';

const ACCESS_REASONS = {
  [DirectoryAccessState.DISCONNECTED]: 'Admin consent has not been granted yet.',
  [DirectoryAccessState.NOT_AUTHORISED]: 'The directory refused the call (unauthorized_client).',
  [DirectoryAccessState.CONSENT_REVOKED]: 'The customer removed OpenFrame’s access. Consent has to be granted again.',
  [DirectoryAccessState.READ_ONLY]: null,
  [DirectoryAccessState.WRITE_AVAILABLE]: null,
  [DirectoryAccessState.WRITE_ENABLED]: null,
} satisfies Record<DirectoryAccessState, string | null>;

const READABLE_STATES: ReadonlySet<DirectoryAccessState> = new Set([
  DirectoryAccessState.READ_ONLY,
  DirectoryAccessState.WRITE_AVAILABLE,
  DirectoryAccessState.WRITE_ENABLED,
]);

const READ_CAPABILITIES: DirectoryCapability[] = [
  DirectoryCapability.USERS,
  DirectoryCapability.GROUPS,
  DirectoryCapability.ORG_UNITS,
  DirectoryCapability.LICENSES,
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** The same normalisation the form schema applies, so the store never holds two spellings of one domain. */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

function cloneConnection(connection: TenantConnection): TenantConnection {
  return {
    ...connection,
    organization: { ...connection.organization },
    access: { ...connection.access, capabilities: [...connection.access.capabilities] },
    domains: connection.domains.map(domain => ({ ...domain })),
  };
}

/**
 * The link the customer's admin opens. Cosmetic: the placeholders are the ones
 * the Figma frames show; the real backend mints the URL (and answers `null` for
 * Microsoft 365, which has no consent-link model — see
 * `components/consent/microsoft-consent-panel.tsx`).
 */
function buildConsentUrl(provider: DirectoryProvider, domain: string, nonce: number): string {
  const state = `state-${nonce}`;
  return provider === DirectoryProvider.GOOGLE_WORKSPACE
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&hd=${domain}&state=${state}`
    : `https://login.microsoftonline.com/${domain}/adminconsent?client_id={client_id}&redirect_uri={redirect_uri}&state=${state}`;
}

/** Deterministic pseudo-values for a freshly read directory, so a demo is repeatable. */
function seededNumber(seed: string, min: number, max: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return min + (hash % (max - min + 1));
}

function mockDirectoryId(provider: DirectoryProvider, seed: string): string {
  const hex = seededNumber(seed, 0x10000000, 0xffffffff).toString(16).padStart(8, '0');
  return provider === DirectoryProvider.GOOGLE_WORKSPACE
    ? `C0${hex.slice(0, 7)}`
    : `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(2, 5)}-${hex}${hex.slice(0, 4)}`;
}

export interface MockTenantConnectionsSeed {
  connections?: readonly TenantConnection[];
  organizations?: readonly TenantOrganization[];
  checkOutcomes?: Readonly<Record<string, DirectoryAccessState>>;
}

/**
 * In-memory mock. State lives for the SPA session (like the remote-access
 * mocks in `devices/services`): connecting, checking, editing and reconnecting
 * all change what the list and the details page show next, so every screen and
 * state of the design can be walked end to end before the backend lands.
 */
class MockTenantConnectionsService implements ITenantConnectionsService {
  private readonly connections = new Map<string, TenantConnection>();
  private readonly organizations = new Map<string, TenantOrganization>();
  private readonly checkOutcomes = new Map<string, DirectoryAccessState>();
  private nextId: number;
  private nonce = 0;

  constructor(seed: MockTenantConnectionsSeed = {}) {
    for (const organization of seed.organizations ?? TENANT_ORGANIZATION_FIXTURES) {
      this.organizations.set(organization.id, { ...organization });
    }
    for (const connection of seed.connections ?? TENANT_CONNECTION_FIXTURES) {
      this.connections.set(connection.id, cloneConnection(connection));
    }
    for (const [id, outcome] of Object.entries(seed.checkOutcomes ?? TENANT_CHECK_OUTCOME_FIXTURES)) {
      this.checkOutcomes.set(id, outcome);
    }
    this.nextId = this.connections.size + 1;
  }

  async list(filter: TenantConnectionsFilter = {}): Promise<TenantConnection[]> {
    await delay(MOCK_LATENCY_MS);
    const term = filter.search?.trim().toLowerCase() ?? '';
    return (
      [...this.connections.values()]
        .filter(connection => !filter.organizationId || connection.organizationId === filter.organizationId)
        // The brief (Figma #105): "search matches the tenant name, every domain and
        // every bound customer" — every verified domain, not only the one entered.
        .filter(
          connection =>
            term === '' ||
            connection.name.toLowerCase().includes(term) ||
            connection.domain.toLowerCase().includes(term) ||
            connection.domains.some(domain => domain.name.toLowerCase().includes(term)) ||
            connection.organization.name.toLowerCase().includes(term),
        )
        .map(cloneConnection)
    );
  }

  async get(id: string): Promise<TenantConnection | null> {
    await delay(MOCK_LATENCY_MS);
    const connection = this.connections.get(id);
    return connection ? cloneConnection(connection) : null;
  }

  async getOptions(): Promise<{ providers: DirectoryProvider[] }> {
    await delay(MOCK_LATENCY_MS);
    return { providers: [DirectoryProvider.MICROSOFT_365, DirectoryProvider.GOOGLE_WORKSPACE] };
  }

  async listAvailableOrganizations(input: TenantOrganizationsPageInput): Promise<TenantOrganizationsPage> {
    await delay(MOCK_LATENCY_MS);
    const bound = new Set([...this.connections.values()].map(connection => connection.organizationId));
    const available = [...this.organizations.values()].filter(
      organization => !bound.has(organization.id) || organization.id === input.includeOrganizationId,
    );
    const start = input.after ? Number.parseInt(input.after, 10) : 0;
    const end = start + Math.max(1, input.first);
    const items = available.slice(start, end).map(organization => ({ ...organization }));
    const hasNextPage = end < available.length;
    return { items, endCursor: hasNextPage ? String(end) : null, hasNextPage };
  }

  async create(input: CreateTenantConnectionInput): Promise<TenantConnection> {
    await delay(MOCK_LATENCY_MS);
    const organization = this.organizations.get(input.organizationId);
    if (!organization) throw new Error(`Customer "${input.organizationId}" was not found.`);
    const id = `tc-${String(this.nextId++).padStart(2, '0')}`;
    const domain = normalizeDomain(input.domain);
    const connection: TenantConnection = {
      id,
      provider: input.provider,
      name: input.name.trim(),
      domain,
      enabled: true,
      directoryId: null,
      grantedBy: null,
      connectedAt: null,
      lastSyncStatus: DirectorySyncStatus.NEVER,
      lastSyncAt: null,
      lastSyncError: null,
      organizationId: organization.id,
      organization: { ...organization },
      userCount: null,
      consentUrl: buildConsentUrl(input.provider, domain, ++this.nonce),
      access: {
        state: DirectoryAccessState.DISCONNECTED,
        reason: ACCESS_REASONS.DISCONNECTED,
        checkedAt: new Date().toISOString(),
        capabilities: [],
      },
      domains: [],
    };
    this.connections.set(id, connection);
    return cloneConnection(connection);
  }

  async update(id: string, input: UpdateTenantConnectionInput): Promise<TenantConnection> {
    await delay(MOCK_LATENCY_MS);
    const connection = this.require(id);
    if (input.domain !== undefined) {
      if (connection.connectedAt) throw new Error(DOMAIN_LOCKED_MESSAGE);
      const domain = normalizeDomain(input.domain);
      if (domain !== connection.domain) {
        connection.domain = domain;
        // The domain is the tenant segment of the link, so the old link is void.
        connection.consentUrl = null;
      }
    }
    if (input.name !== undefined) connection.name = input.name.trim();
    if (input.organizationId !== undefined) {
      const organization = this.organizations.get(input.organizationId);
      if (!organization) throw new Error(`Customer "${input.organizationId}" was not found.`);
      connection.organizationId = organization.id;
      connection.organization = { ...organization };
    }
    return cloneConnection(connection);
  }

  async startConsent(id: string): Promise<TenantConnection> {
    await delay(MOCK_LATENCY_MS);
    const connection = this.require(id);
    connection.consentUrl = buildConsentUrl(connection.provider, connection.domain, ++this.nonce);
    return cloneConnection(connection);
  }

  async check(id: string): Promise<TenantAccess> {
    const slow = this.connections.get(id)?.domain.endsWith(MOCK_SLOW_DOMAIN_SUFFIX) ?? false;
    await delay(slow ? MOCK_SLOW_CHECK_LATENCY_MS : MOCK_CHECK_LATENCY_MS);
    const connection = this.require(id);
    if (connection.domain.endsWith(MOCK_ERROR_DOMAIN_SUFFIX)) {
      throw new Error('The provider returned an error. Try again in a moment.');
    }
    const state = this.outcomeFor(connection);
    // One refusal per seeded row (see MOCK_DOMAIN_OUTCOMES); the next probe answers
    // like any other connection.
    this.checkOutcomes.delete(id);
    const now = new Date().toISOString();
    if (READABLE_STATES.has(state)) {
      connection.connectedAt ??= now;
      connection.lastSyncStatus = DirectorySyncStatus.SUCCESS;
      connection.lastSyncAt = now;
      connection.lastSyncError = null;
      connection.directoryId ??= mockDirectoryId(connection.provider, connection.domain);
      connection.grantedBy ??= `admin@${connection.domain}`;
      connection.userCount ??= seededNumber(connection.domain, 20, 400);
      if (connection.domains.length === 0) {
        connection.domains = [{ name: connection.domain, primary: true, verified: true }];
      }
      // Consent has been granted: no link is outstanding any more.
      connection.consentUrl = null;
    }
    connection.access = {
      state,
      reason: ACCESS_REASONS[state],
      checkedAt: now,
      capabilities: READABLE_STATES.has(state)
        ? state === DirectoryAccessState.WRITE_ENABLED
          ? Object.values(DirectoryCapability)
          : READ_CAPABILITIES
        : [],
    };
    return { ...connection.access, capabilities: [...connection.access.capabilities] };
  }

  private require(id: string): TenantConnection {
    const connection = this.connections.get(id);
    if (!connection) throw new TenantConnectionNotFoundError(id);
    return connection;
  }

  private outcomeFor(connection: TenantConnection): DirectoryAccessState {
    const scripted = this.checkOutcomes.get(connection.id);
    if (scripted) return scripted;
    for (const [suffix, outcome] of Object.entries(MOCK_DOMAIN_OUTCOMES)) {
      if (connection.domain.endsWith(suffix)) return outcome;
    }
    return DirectoryAccessState.READ_ONLY;
  }
}

/** A fresh instance — tests take one each so the seeded rows cannot leak between them. */
export function createMockTenantConnectionsService(seed?: MockTenantConnectionsSeed): ITenantConnectionsService {
  return new MockTenantConnectionsService(seed);
}

export const tenantConnectionsService: ITenantConnectionsService = createMockTenantConnectionsService();
