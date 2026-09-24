// Tenant Management read model, mapped from `DirectoryConnection` by the service in three
// steps (record ⊂ row ⊂ connection): each live provider probe is paid only where it is shown.
// Enums are widened the way Relay delivers them, so a value from a newer backend renders raw.

import type {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryProvider,
  DirectorySyncStatus,
} from '@/generated/schema-enums';

/** An enum as it arrives from Relay: the named members plus `%future added value` (see `subscription.types.ts`). */
type FromRelay<T extends string> = T | (string & {});

/** The customer (OpenFrame organization) a connection belongs to. */
export interface TenantOrganization {
  /** The business `organizationId` — what the directory API takes and returns, NOT the Relay node id. */
  id: string;
  name: string;
  imageUrl?: string | null;
  imageHash?: string | null;
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
  state: FromRelay<DirectoryAccessState>;
  /** Empty when there is no grant to describe (never connected / revoked). */
  capabilities: FromRelay<DirectoryCapability>[];
}

/** The stored fields of a `DirectoryConnection` — no provider probe; what the writes return. */
export interface TenantConnectionRecord {
  id: string;
  provider: FromRelay<DirectoryProvider>;
  /** User-facing connection label, unique per tenant+provider. */
  name: string;
  /** The customer's primary domain; null only for a Microsoft 365 connection created from a directory GUID. */
  domain: string | null;
  enabled: boolean;
  /** Entra tenant GUID / Google customerId. Null until the first consent. */
  directoryId: string | null;
  /** Account that granted consent. Microsoft 365 does not report it yet. */
  grantedBy: string | null;
  /** Most recent successful consent. Microsoft 365 does not report it yet. */
  connectedAt: string | null;
  lastSyncStatus: FromRelay<DirectorySyncStatus>;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  /** Business id of the bound customer (= `organization.id`). */
  organizationId: string;
  organization: TenantOrganization;
  /** Users synced under this connection; null until the first sync. */
  userCount: number | null;
  /** The outstanding consent link; null when none is (never minted, expired, or already consented). */
  consentUrl: string | null;
}

/** A list row: the record plus its live access state (one provider probe). */
export interface TenantConnectionRow extends TenantConnectionRecord {
  access: TenantAccess;
}

/** The details page: the row plus the verified domains (a second provider probe). */
export interface TenantConnection extends TenantConnectionRow {
  domains: TenantDomain[];
}

/** `DirectoryConnectionFilterInput` plus the client-side customer narrowing the Customer tab will need. */
export interface TenantConnectionsFilter {
  /** Case-insensitive substring over the name, the stored domain and the customer's name. */
  search?: string;
  /** Not a backend filter — applied to the fetched rows. */
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
