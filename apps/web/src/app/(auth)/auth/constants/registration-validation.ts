/**
 * Field rules shared by every registration surface, so the same input cannot be judged two ways.
 *
 * Each rule restates the auth server's own (openframe-oss-lib: `CoreUserRequest`,
 * `TenantRegistrationRequest`, `PasswordResetDtos`, `@ValidEmail`, `@TenantDomain`), so a value the
 * form accepts is one the server accepts. Change them together.
 */

export const ORG_NAME_REGEX = /^[\p{L}\p{M}0-9&.,'’"()\- ]{2,100}$/u;

export const ORG_NAME_ERROR = `Use 2-100 letters, digits, spaces, & . , ' ’ " ( ) -`;

/**
 * Shape check for an address that is only looked up (login discovery, availability): those
 * endpoints take the looser `@Email`. Accounts created through SSO or an invitation never passed
 * `@ValidEmail`, so holding the login to it would turn some of them away.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `@ValidEmail`: what registration and the password-reset request accept. */
export const VALID_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export const INVALID_EMAIL_ERROR = 'Enter a valid email address';

/** A letter first, then letters, combining marks, apostrophes, spaces and hyphens: 50 characters at most. */
export const PERSON_NAME_REGEX = /^\p{L}[\p{L}\p{M}' -]{0,49}$/u;

/**
 * Field errors are one line, cut off with an ellipsis, and the signup form puts names and passwords
 * in half-width columns (247px on a desktop). These two are written to fit there.
 */
export const PERSON_NAME_ERROR = "Letters, spaces, ' and - only (max 50)";

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_TOO_SHORT_ERROR = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

/** The special character must come from this exact set: `~`, a backtick and `\` do not count. */
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}[\]|:;"'<>,.?/]).+$/;

/**
 * The server's own sentence ("Password must contain at least one uppercase letter, one lowercase
 * letter, one digit, and one special character") needs 730px; a field shows 247-518px of it.
 */
export const PASSWORD_COMPLEXITY_ERROR = 'Use A-Z, a-z, 0-9 and a symbol';

export const PASSWORDS_DO_NOT_MATCH_ERROR = 'Passwords do not match';

/** What the server's `toSlug` leaves unchanged: no leading, trailing or doubled hyphen. */
export const TENANT_SUBDOMAIN_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Typing is already limited to `[a-z0-9-]`, so hyphen placement is all this can be about. */
export const TENANT_SUBDOMAIN_ERROR = "Hyphens can't start, end or repeat";

/**
 * The name as it is sent: trimmed, and with the typographic apostrophe iOS types by default (Smart
 * Punctuation) turned into the plain one, the only one the server accepts.
 */
export function normalizePersonName(value: string): string {
  return value.trim().replace(/’/g, "'");
}

export function isValidPersonName(value: string): boolean {
  return PERSON_NAME_REGEX.test(normalizePersonName(value));
}

/** The first rule the server would reject this password on, in its own words. */
export function getPasswordError(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT_ERROR;
  if (!PASSWORD_COMPLEXITY_REGEX.test(password)) return PASSWORD_COMPLEXITY_ERROR;
  return undefined;
}

/** Subdomains accept only lowercase letters, digits and dashes. */
export function sanitizeSubdomain(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}
