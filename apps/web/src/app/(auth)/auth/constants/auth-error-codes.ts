/**
 * Backend error codes returned by the SaaS-shared auth & registration endpoints
 * (domain availability, organization registration).
 *
 * Centralized so both the domain-availability check (choice-section) and the
 * organization registration handler (use-auth) reference the same constants
 * instead of duplicating string literals.
 */
export const AUTH_ERROR_CODE = {
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  TENANT_REGISTRATION_BLOCKED: 'TENANT_REGISTRATION_BLOCKED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

/**
 * Names from the auth server's `AuthErrorCode` catalog that the frontend itself sends the error page
 * to, as `/auth/error?ref=<name>`. Only the names the frontend emits live here: the page never maps a
 * name to text, the `authErrorMessage` query does, so a name the catalog does not know renders the
 * generic entry instead of anything written on this side.
 */
export const AUTH_ERROR_REF = {
  /** `/auth/verify` opened without a token - the same code the server's own verification uses. */
  VERIFICATION_LINK_INVALID: 'VERIFICATION_LINK_INVALID',
} as const;

export type AuthErrorRef = (typeof AUTH_ERROR_REF)[keyof typeof AUTH_ERROR_REF];
