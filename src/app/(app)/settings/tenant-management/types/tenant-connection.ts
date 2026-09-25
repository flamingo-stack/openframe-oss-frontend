// Tenant Management domain model.
//
// `TenantConnection` mirrors the backend `DirectoryConnection` type field for
// field (branch `feature/directory-fe-integration`,
// `schema-directory/directory-integrations.graphqls`) so the mock service, the
// hooks and every component already speak the shape the Relay swap will deliver.
// Keep it in sync with that SDL rather than with what a screen happens to need.

import type {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryProvider,
  DirectorySyncStatus,
} from './directory-enums';

/** The customer (OpenFrame organization) a connection belongs to. */
export interface TenantOrganization {
  id: string;
  name: string;
  imageUrl?: string | null;
}

/** A verified domain read live from the provider. */
export interface TenantDomain {
  name: string;
  /** Provider's default/primary domain. */
  primary?: boolean | null;
  /** `null` when the provider could not confirm. */
  verified?: boolean | null;
}

/** `DirectoryConnectionAccess` — resolved live, never stored. */
export interface TenantAccess {
  state: DirectoryAccessState;
  /** Raw provider status, for tooltips. */
  reason?: string | null;
  checkedAt: string;
  /** Empty when there is no grant to describe (never connected / revoked). */
  capabilities: DirectoryCapability[];
}

/** `DirectoryConnection` */
export interface TenantConnection {
  id: string;
  provider: DirectoryProvider;
  /** User-facing connection label, unique per tenant+provider. */
  name: string;
  /** Customer domain entered at creation; frozen after the first successful consent. */
  domain: string;
  enabled: boolean;
  /** Provider's own directory id — Entra tenant GUID / Google customerId. Null until first consent. */
  directoryId?: string | null;
  /** Account that granted consent. Null until first consent. */
  grantedBy?: string | null;
  /** Most recent successful consent; a reconnect moves it. Null while never connected. */
  connectedAt?: string | null;
  lastSyncStatus: DirectorySyncStatus;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  organizationId: string;
  organization: TenantOrganization;
  /** Users synced under this connection. Null before the first read. */
  userCount?: number | null;
  /**
   * The consent link the customer's admin has to open. Null = no link
   * outstanding (never minted, expired, already consented — or, on the current
   * FE facade, any Microsoft 365 connection: the facade predates the provider's
   * admin-consent API; see `consent/microsoft-consent-panel.tsx`).
   */
  consentUrl?: string | null;
  access: TenantAccess;
  domains: TenantDomain[];
}

/** `DirectoryConnectionFilterInput` plus the client-side narrowing the future Customer tab needs. */
export interface TenantConnectionsFilter {
  /** Case-insensitive substring over `name`, `domain` and the customer's name. */
  search?: string;
  organizationId?: string;
}

/** `CreateDirectoryConnectionInput` */
export interface CreateTenantConnectionInput {
  provider: DirectoryProvider;
  domain: string;
  name: string;
  organizationId: string;
}

/** `UpdateDirectoryConnectionInput` — `domain` is accepted only while the connection has never connected. */
export interface UpdateTenantConnectionInput {
  name?: string;
  organizationId?: string;
  domain?: string;
}

/** One page of `directoryConnectionOrganizations`. */
export interface TenantOrganizationsPage {
  items: TenantOrganization[];
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface TenantOrganizationsPageInput {
  first: number;
  after?: string | null;
  /**
   * The backend list excludes customers already bound to a connection; the Edit
   * form still has to show its own customer, so it asks for it back explicitly.
   */
  includeOrganizationId?: string;
}
