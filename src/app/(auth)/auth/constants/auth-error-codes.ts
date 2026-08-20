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
 * Detects the 409 `TENANT_REGISTRATION_BLOCKED` response the registration
 * endpoints return when the cluster has no capacity for a new tenant. Shared by
 * the live availability check and the submit-time re-check so both read the same
 * error envelope. `message` is the backend copy (may be absent); callers apply
 * their own fallback.
 */
export function isTenantRegistrationBlocked(response: { status: number; data?: unknown }): {
  blocked: boolean;
  message?: string;
} {
  const body = response.data as { code?: string; message?: string } | undefined;
  const blocked = response.status === 409 && body?.code === AUTH_ERROR_CODE.TENANT_REGISTRATION_BLOCKED;
  return { blocked, message: blocked ? body?.message : undefined };
}
