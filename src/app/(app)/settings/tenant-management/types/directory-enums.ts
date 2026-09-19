// TEMPORARY mirrors of the directory-integration enums (CU-86akj8ajt).
//
// The backend contract lives on `openframe-saas-tenant` branch
// `feature/directory-fe-integration` (`schema-directory/directory-integrations.graphqls`)
// and is not in this repo's `schema.graphql` yet, so `npm run generate-enums` cannot
// emit these. The shapes below copy the generated file's style exactly (const +
// same-named type) so the swap is type-identical:
//
//   1. `npm run fetch-schema -- --endpoint <feature tenant> --token <JWT>`
//   2. `npm run generate-enums`
//   3. replace the bodies of this file with
//      `export { DirectoryProvider, DirectoryAccessState, DirectorySyncStatus, DirectoryCapability } from '@/generated/schema-enums';`
//
// Every `satisfies Record<…>` presentation table over these enums then stops
// type-checking for any value the SDL added — which is the point.

export const DirectoryProvider = {
  GOOGLE_WORKSPACE: 'GOOGLE_WORKSPACE',
  MICROSOFT_365: 'MICROSOFT_365',
} as const;
export type DirectoryProvider = (typeof DirectoryProvider)[keyof typeof DirectoryProvider];

/**
 * Resolved live from a restricted-scope read, never stored. Reachability wins:
 * a tenant that cannot be read reports that, not the write posture it could
 * not use.
 */
export const DirectoryAccessState = {
  DISCONNECTED: 'DISCONNECTED',
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  CONSENT_REVOKED: 'CONSENT_REVOKED',
  READ_ONLY: 'READ_ONLY',
  WRITE_AVAILABLE: 'WRITE_AVAILABLE',
  WRITE_ENABLED: 'WRITE_ENABLED',
} as const;
export type DirectoryAccessState = (typeof DirectoryAccessState)[keyof typeof DirectoryAccessState];

export const DirectorySyncStatus = {
  NEVER: 'NEVER',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
} as const;
export type DirectorySyncStatus = (typeof DirectorySyncStatus)[keyof typeof DirectorySyncStatus];

/** What the current grant permits, mapped from the provider's granted scopes. */
export const DirectoryCapability = {
  USERS: 'USERS',
  GROUPS: 'GROUPS',
  ORG_UNITS: 'ORG_UNITS',
  LICENSES: 'LICENSES',
  DEVICES: 'DEVICES',
  AUDIT_LOGS: 'AUDIT_LOGS',
  OAUTH_APPS: 'OAUTH_APPS',
  ADMIN_ROLES: 'ADMIN_ROLES',
} as const;
export type DirectoryCapability = (typeof DirectoryCapability)[keyof typeof DirectoryCapability];
