import { commitMutation, fetchQuery, graphql } from 'react-relay';
import { type GraphQLTaggedNode, type MutationParameters, type OperationType, readInlineData } from 'relay-runtime';
import type { tenantConnectionsService_connection$key as ConnectionKey } from '@/__generated__/tenantConnectionsService_connection.graphql';
import type { tenantConnectionsService_organization$key as OrganizationKey } from '@/__generated__/tenantConnectionsService_organization.graphql';
import type {
  tenantConnectionsService_record$data as RecordData,
  tenantConnectionsService_record$key as RecordKey,
} from '@/__generated__/tenantConnectionsService_record.graphql';
import type {
  tenantConnectionsService_row$data as RowData,
  tenantConnectionsService_row$key as RowKey,
} from '@/__generated__/tenantConnectionsService_row.graphql';
import type { tenantConnectionsServiceCheckMutation as CheckMutation } from '@/__generated__/tenantConnectionsServiceCheckMutation.graphql';
import type { tenantConnectionsServiceCreateMutation as CreateMutation } from '@/__generated__/tenantConnectionsServiceCreateMutation.graphql';
import type { tenantConnectionsServiceDetailsQuery as DetailsQuery } from '@/__generated__/tenantConnectionsServiceDetailsQuery.graphql';
import type { tenantConnectionsServiceListQuery as ListQuery } from '@/__generated__/tenantConnectionsServiceListQuery.graphql';
import type { tenantConnectionsServiceOptionsQuery as OptionsQuery } from '@/__generated__/tenantConnectionsServiceOptionsQuery.graphql';
import type { tenantConnectionsServiceOrganizationsQuery as OrganizationsQuery } from '@/__generated__/tenantConnectionsServiceOrganizationsQuery.graphql';
import type { tenantConnectionsServiceRecordsQuery as RecordsQuery } from '@/__generated__/tenantConnectionsServiceRecordsQuery.graphql';
import type { tenantConnectionsServiceStartConsentMutation as StartConsentMutation } from '@/__generated__/tenantConnectionsServiceStartConsentMutation.graphql';
import type { tenantConnectionsServiceUpdateMutation as UpdateMutation } from '@/__generated__/tenantConnectionsServiceUpdateMutation.graphql';
import { DirectoryProvider } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { isOfflineError } from '@/lib/query-state';
import { getRelayEnvironment } from '@/lib/relay';
import type {
  CreateTenantConnectionInput,
  TenantAccess,
  TenantConnection,
  TenantConnectionRecord,
  TenantConnectionRow,
  TenantConnectionsFilter,
  TenantOrganization,
  UpdateTenantConnectionInput,
} from '../types/tenant-connection';

// The directory API (openframe-saas-api, `schema-directory/directory-integrations.graphqls`),
// run imperatively on the app's Relay environment the way the remote-access approval
// service is, so the hooks keep their react-query shape and only this file knows GraphQL.

export interface ITenantConnectionsService {
  /** `directoryConnections(filter:)`, every page; `search` matches the name, the stored domain and the customer's name. */
  list(filter?: TenantConnectionsFilter): Promise<TenantConnectionRow[]>;
  /** One connection with its domains, or `null` when the id is unknown (the details page's not-found branch). */
  get(id: string): Promise<TenantConnection | null>;
  /** `directoryConnectionOptions` — the providers this deployment offers. */
  getOptions(): Promise<{ providers: DirectoryProvider[] }>;
  /** `directoryConnectionOrganizations`, every page up to a cap — customers not yet bound to any connection. */
  listAvailableOrganizations(): Promise<TenantOrganization[]>;
  /** `createDirectoryConnection` — persists a DISCONNECTED record and mints its first consent link. */
  create(input: CreateTenantConnectionInput): Promise<TenantConnectionRecord>;
  /** `updateDirectoryConnection` — rename / move / correct the domain (domain only before the first consent). */
  update(id: string, input: UpdateTenantConnectionInput): Promise<TenantConnectionRecord>;
  /** `startDirectoryConsent` — mints a fresh consent link, replacing any outstanding one. */
  startConsent(id: string): Promise<TenantConnectionRecord>;
  /** `checkDirectoryConnection` — probes the provider now; an unreachable one is a state, not an error. */
  check(id: string): Promise<TenantAccess>;
}

/** A refusal the API reported in `userErrors` (every one carries `DIRECTORY_CONNECTION_ERROR` today). */
export class TenantConnectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TenantConnectionError';
    this.code = code;
  }
}

// The customer as both the record and the picker select it, so one mapper reads both.
const organizationFragment = graphql`
  fragment tenantConnectionsService_organization on Organization @inline {
    organizationId
    name
    image {
      imageUrl
      hash
    }
  }
`;

// A three-step ladder: `access` and `domains` are each a live provider call, so the writes
// take the stored record, the list adds `access`, and only the details page pays `domains`.
const recordFragment = graphql`
  fragment tenantConnectionsService_record on DirectoryConnection @inline {
    id
    provider
    name
    domain
    enabled
    directoryId
    grantedBy
    connectedAt
    lastSyncStatus
    lastSyncAt
    lastSyncError
    organizationId
    organization {
      ...tenantConnectionsService_organization
    }
    userCount
    consentUrl
  }
`;

const rowFragment = graphql`
  fragment tenantConnectionsService_row on DirectoryConnection @inline {
    ...tenantConnectionsService_record
    access {
      state
      capabilities
    }
  }
`;

const connectionFragment = graphql`
  fragment tenantConnectionsService_connection on DirectoryConnection @inline {
    ...tenantConnectionsService_row
    domains {
      name
      primary
      verified
    }
  }
`;

const recordsQuery = graphql`
  query tenantConnectionsServiceRecordsQuery($limit: Int, $cursor: String) {
    directoryConnections(pagination: { limit: $limit, cursor: $cursor }) {
      edges {
        node {
          ...tenantConnectionsService_record
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const listQuery = graphql`
  query tenantConnectionsServiceListQuery($search: String, $limit: Int, $cursor: String) {
    directoryConnections(filter: { search: $search }, pagination: { limit: $limit, cursor: $cursor }) {
      edges {
        node {
          ...tenantConnectionsService_row
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const detailsQuery = graphql`
  query tenantConnectionsServiceDetailsQuery($search: String, $limit: Int, $cursor: String) {
    directoryConnections(filter: { search: $search }, pagination: { limit: $limit, cursor: $cursor }) {
      edges {
        node {
          ...tenantConnectionsService_connection
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const optionsQuery = graphql`
  query tenantConnectionsServiceOptionsQuery {
    directoryConnectionOptions {
      providers
    }
  }
`;

const organizationsQuery = graphql`
  query tenantConnectionsServiceOrganizationsQuery($first: Int, $after: String) {
    directoryConnectionOrganizations(first: $first, after: $after) {
      edges {
        node {
          ...tenantConnectionsService_organization
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const createMutation = graphql`
  mutation tenantConnectionsServiceCreateMutation($input: CreateDirectoryConnectionInput!) {
    createDirectoryConnection(input: $input) {
      connection {
        ...tenantConnectionsService_record
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const updateMutation = graphql`
  mutation tenantConnectionsServiceUpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
    updateDirectoryConnection(connectionId: $connectionId, input: $input) {
      connection {
        ...tenantConnectionsService_record
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const startConsentMutation = graphql`
  mutation tenantConnectionsServiceStartConsentMutation($connectionId: ID!) {
    startDirectoryConsent(connectionId: $connectionId) {
      connection {
        ...tenantConnectionsService_record
      }
      userErrors {
        code
        message
      }
    }
  }
`;

// Only `access`: the probe refreshes nothing else, and selecting `domains` would add a second provider call.
const checkMutation = graphql`
  mutation tenantConnectionsServiceCheckMutation($connectionId: ID!) {
    checkDirectoryConnection(connectionId: $connectionId) {
      connection {
        access {
          state
          capabilities
        }
      }
      userErrors {
        code
        message
      }
    }
  }
`;

/** Page size of every list read: `pagination.limit` above 100 is a validation error, whatever the SDL says. */
export const TENANT_CONNECTIONS_PAGE_SIZE = 100;
/** Where the connection list stops paging — far above any MSP's tenant count, low enough to never spin. */
export const TENANT_CONNECTIONS_CAP = 1000;
/** Where the customer picker stops: past this a search-less `Select` needs a search box instead. */
export const TENANT_ORGANIZATIONS_CAP = 500;

const LOAD_FAILED = 'Could not load tenant connections';

/** `Instant` reaches Relay untyped (`any`); the API writes ISO-8601, so anything else counts as absent. */
function instant(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function readOrganization(ref: OrganizationKey): TenantOrganization {
  const organization = readInlineData(organizationFragment, ref);
  return {
    id: organization.organizationId,
    name: organization.name,
    imageUrl: organization.image?.imageUrl ?? null,
    imageHash: organization.image?.hash ?? null,
  };
}

function fromWireRecord(data: RecordData): TenantConnectionRecord {
  return {
    id: data.id,
    provider: data.provider,
    name: data.name,
    domain: data.domain ?? null,
    enabled: data.enabled,
    directoryId: data.directoryId ?? null,
    grantedBy: data.grantedBy ?? null,
    connectedAt: instant(data.connectedAt),
    lastSyncStatus: data.lastSyncStatus,
    lastSyncAt: instant(data.lastSyncAt),
    lastSyncError: data.lastSyncError ?? null,
    organizationId: data.organizationId,
    organization: readOrganization(data.organization),
    userCount: data.userCount ?? null,
    consentUrl: data.consentUrl ?? null,
  };
}

function toAccess(access: RowData['access']): TenantAccess {
  return { state: access.state, capabilities: [...access.capabilities] };
}

/** Step 1 — the stored record. */
function readRecord(ref: RecordKey): TenantConnectionRecord {
  return fromWireRecord(readInlineData(recordFragment, ref));
}

/** Step 2 — the record plus its live access state. */
function readRow(ref: RowKey): TenantConnectionRow {
  const data = readInlineData(rowFragment, ref);
  return { ...readRecord(data), access: toAccess(data.access) };
}

/** Step 3 — the row plus the verified domains; exported for the tests, which read the whole ladder through it. */
export function readConnection(ref: ConnectionKey): TenantConnection {
  const data = readInlineData(connectionFragment, ref);
  return {
    ...readRow(data),
    domains: data.domains.map(domain => ({ name: domain.name, primary: domain.primary, verified: domain.verified })),
  };
}

/** A Relay failure in the backend's own words (its "No data returned…" wrapper stripped); offline passes through. */
function toServiceError(error: unknown): Error {
  return isOfflineError(error) ? error : new Error(getRelayErrorMessage(error));
}

interface WirePayload<TConnection> {
  readonly connection: TConnection | null | undefined;
  readonly userErrors: ReadonlyArray<{ readonly code: string; readonly message: string }>;
}

/** A payload's connection, or the refusal it carries — a `userErrors` answer is a failure, not an empty success. */
function unwrap<TConnection>(payload: WirePayload<TConnection>, fallback: string): TConnection {
  const [first] = payload.userErrors;
  if (first) throw new TenantConnectionError(first.code, first.message || fallback);
  if (!payload.connection) throw new Error(fallback);
  return payload.connection;
}

/** `commitMutation` as a promise: GraphQL-level errors reject, the payload resolves. */
function commit<TMutation extends MutationParameters>(
  mutation: GraphQLTaggedNode,
  variables: TMutation['variables'],
): Promise<TMutation['response']> {
  return new Promise((resolve, reject) => {
    commitMutation<TMutation>(getRelayEnvironment(), {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        if (errors?.length) reject(new Error(errors[0].message));
        else resolve(response);
      },
      onError: error => reject(toServiceError(error)),
    });
  });
}

/** A fresh read every time: react-query owns the caching, Relay only the transport, gates and 401 refresh. */
async function query<TQuery extends OperationType>(
  node: GraphQLTaggedNode,
  variables: TQuery['variables'],
  failure: string,
): Promise<TQuery['response']> {
  const data = await fetchQuery<TQuery>(getRelayEnvironment(), node, variables, { fetchPolicy: 'network-only' })
    .toPromise()
    .catch((error: unknown) => {
      throw toServiceError(error);
    });
  if (!data) throw new Error(failure);
  return data;
}

interface Page<T> {
  rows: T[];
  nextCursor: string | null;
}

interface WirePage<TNode> {
  readonly edges: ReadonlyArray<{ readonly node: TNode }>;
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor?: string | null };
}

function toPage<TNode, T>({ edges, pageInfo }: WirePage<TNode>, read: (node: TNode) => T): Page<T> {
  return {
    rows: edges.map(edge => read(edge.node)),
    // `totalCount` can overstate (deleted rows stay counted), so the end is `hasNextPage`, never the count.
    nextCursor: pageInfo.hasNextPage ? (pageInfo.endCursor ?? null) : null,
  };
}

/** Every page up to `cap`, stopping early once `done` holds for what has arrived. */
async function collect<T>(
  fetchPage: (cursor: string | null) => Promise<Page<T>>,
  { cap = TENANT_CONNECTIONS_CAP, done = () => false }: { cap?: number; done?: (rows: T[]) => boolean } = {},
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  do {
    const page: Page<T> = await fetchPage(cursor);
    rows.push(...page.rows);
    if (done(rows)) return rows;
    cursor = page.nextCursor;
  } while (cursor && rows.length < cap);
  if (cursor && process.env.NODE_ENV === 'development') {
    console.warn(`[tenant-management] stopped paging at ${rows.length} rows; the rest are not shown`);
  }
  return rows;
}

function findById<T extends { id: string }>(rows: T[], id: string): T | undefined {
  return rows.find(row => row.id === id);
}

export class TenantConnectionsApiService implements ITenantConnectionsService {
  async list(filter: TenantConnectionsFilter = {}): Promise<TenantConnectionRow[]> {
    const search = filter.search?.trim() || null;
    const rows = await collect(async cursor => {
      const variables = { search, limit: TENANT_CONNECTIONS_PAGE_SIZE, cursor };
      return toPage((await query<ListQuery>(listQuery, variables, LOAD_FAILED)).directoryConnections, readRow);
    });
    return filter.organizationId ? rows.filter(row => row.organizationId === filter.organizationId) : rows;
  }

  // TODO(backend): replace with a by-id read once the API has one. Until then a probe-free
  // scan finds the name, and only the rows the name search returns pay the full step's probes.
  async get(id: string): Promise<TenantConnection | null> {
    const records = await collect(
      async cursor => {
        const variables = { limit: TENANT_CONNECTIONS_PAGE_SIZE, cursor };
        return toPage(
          (await query<RecordsQuery>(recordsQuery, variables, LOAD_FAILED)).directoryConnections,
          readRecord,
        );
      },
      { done: found => findById(found, id) !== undefined },
    );
    const record = findById(records, id);
    if (!record) return null;
    return (await this.details(id, record.name)) ?? (await this.details(id, null));
  }

  private async details(id: string, search: string | null): Promise<TenantConnection | null> {
    const rows = await collect(
      async cursor => {
        const variables = { search, limit: TENANT_CONNECTIONS_PAGE_SIZE, cursor };
        return toPage(
          (await query<DetailsQuery>(detailsQuery, variables, LOAD_FAILED)).directoryConnections,
          readConnection,
        );
      },
      { done: found => findById(found, id) !== undefined },
    );
    return findById(rows, id) ?? null;
  }

  async getOptions(): Promise<{ providers: DirectoryProvider[] }> {
    const data = await query<OptionsQuery>(optionsQuery, {}, 'Could not load the providers');
    // The form sends the chosen provider back as an input enum, so one this build does not know is left out.
    return {
      providers: data.directoryConnectionOptions.providers
        .map(provider => knownValue(DirectoryProvider, provider))
        .filter((provider): provider is DirectoryProvider => provider !== null),
    };
  }

  async listAvailableOrganizations(): Promise<TenantOrganization[]> {
    return collect(
      async cursor => {
        const variables = { first: TENANT_CONNECTIONS_PAGE_SIZE, after: cursor };
        const data = await query<OrganizationsQuery>(organizationsQuery, variables, 'Could not load customers');
        return toPage(data.directoryConnectionOrganizations, readOrganization);
      },
      { cap: TENANT_ORGANIZATIONS_CAP },
    );
  }

  async create(input: CreateTenantConnectionInput): Promise<TenantConnectionRecord> {
    const payload = await commit<CreateMutation>(createMutation, { input });
    return readRecord(unwrap(payload.createDirectoryConnection, 'Could not create the connection'));
  }

  async update(id: string, input: UpdateTenantConnectionInput): Promise<TenantConnectionRecord> {
    const payload = await commit<UpdateMutation>(updateMutation, { connectionId: id, input });
    return readRecord(unwrap(payload.updateDirectoryConnection, 'Could not update the connection'));
  }

  async startConsent(id: string): Promise<TenantConnectionRecord> {
    const payload = await commit<StartConsentMutation>(startConsentMutation, { connectionId: id });
    return readRecord(unwrap(payload.startDirectoryConsent, 'Could not create a consent link'));
  }

  async check(id: string): Promise<TenantAccess> {
    const payload = await commit<CheckMutation>(checkMutation, { connectionId: id });
    return toAccess(unwrap(payload.checkDirectoryConnection, 'Could not check the connection').access);
  }
}

export const tenantConnectionsService: ITenantConnectionsService = new TenantConnectionsApiService();
