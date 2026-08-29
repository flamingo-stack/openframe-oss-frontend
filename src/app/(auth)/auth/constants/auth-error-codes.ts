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
  // Returned only when a signup carries a `prNumber` (dev/QA only): the PR
  // environment it points at cannot be claimed. Missing = no tenant-<prNumber>-*
  // namespace exists (404); not-ready = one exists but is not READY (409).
  PR_NAMESPACE_NOT_FOUND: 'PR_NAMESPACE_NOT_FOUND',
  PR_NAMESPACE_UNAVAILABLE: 'PR_NAMESPACE_UNAVAILABLE',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

/** Which part of the PR-namespace claim failed. */
export type PrNamespaceIssue = 'missing' | 'not-ready';

/**
 * Detects the PR-namespace registration failures. Returns the issue when the
 * response is one of them, so the signup form can show a persistent inline notice
 * and offer recovery instead of a fading toast with the raw backend string.
 */
export function getPrNamespaceIssue(response: { status: number; data?: unknown }): PrNamespaceIssue | undefined {
  const code = (response.data as { code?: string } | undefined)?.code;
  if (code === AUTH_ERROR_CODE.PR_NAMESPACE_NOT_FOUND) return 'missing';
  if (code === AUTH_ERROR_CODE.PR_NAMESPACE_UNAVAILABLE) return 'not-ready';
  return undefined;
}
