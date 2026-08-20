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

/** Human copy for a resolved auth failure. */
export interface AuthErrorMessage {
  title: string;
  description: string;
}

const DEFAULT_AUTH_ERROR: AuthErrorMessage = {
  title: 'Oops, Something Went Wrong',
  description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
};

/**
 * Maps a raw error string from the gateway or an identity provider to human
 * copy. The gateway appends the raw code to the auth redirect (either
 * `/auth/error?error=…` or a bounce back to `/auth/login?error=…`), so match on
 * substrings — the raw value can arrive bracket-wrapped (`[code]`) or as the
 * full provider text (`AADSTS700016: Application …`).
 */
export function resolveAuthError(rawError: string | null | undefined): AuthErrorMessage {
  const normalized = (rawError ?? '').trim().toLowerCase();
  if (!normalized) return DEFAULT_AUTH_ERROR;

  // Azure AD errors carry an AADSTS<number> code (e.g. AADSTS700016 = the app is
  // not registered in the directory).
  if (normalized.includes('aadsts')) {
    return {
      title: 'Sign-In Was Rejected',
      description:
        'Your organization identity provider rejected the sign-in. Please contact your administrator or try a different account.',
    };
  }

  if (normalized.includes('authorization_request_not_found')) {
    return {
      title: 'Your Sign-In Attempt Expired',
      description:
        'This sign-in request is no longer valid. It can expire when a login takes too long or is opened again in a new tab. Please start again.',
    };
  }

  if (normalized.includes('invalid_token_response')) {
    return {
      title: 'Sign-In Could Not Complete',
      description: 'We could not finish sign-in with your identity provider. Please try again.',
    };
  }

  if (normalized.includes('expired')) {
    return {
      title: 'Your Session Expired',
      description: 'Your session has expired for security reasons. Please sign in again.',
    };
  }

  return DEFAULT_AUTH_ERROR;
}
