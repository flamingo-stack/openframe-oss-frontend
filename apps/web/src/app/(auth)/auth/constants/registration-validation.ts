/** Field rules shared by every registration surface, so the same input cannot be judged two ways. */

export const ORG_NAME_REGEX = /^[\p{L}\p{M}0-9&.,'"()\- ]{2,100}$/u;

export const ORG_NAME_ERROR = 'Organization Name must be 2-100 characters';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INVALID_EMAIL_ERROR = 'Enter a valid email address';

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_TOO_SHORT_ERROR = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

export const PASSWORDS_DO_NOT_MATCH_ERROR = 'Passwords do not match';

/** Subdomains accept only lowercase letters, digits and dashes. */
export function sanitizeSubdomain(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}
