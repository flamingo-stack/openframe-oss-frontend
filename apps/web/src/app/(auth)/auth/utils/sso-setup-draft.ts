/**
 * The organization details typed on `/auth/sso-continue`, kept across the new sign-in an expired SAS session forces.
 *
 * The page cannot keep them itself: an expired session sends the user back through the provider, which is a
 * full-page round trip, and `/sas/oauth/login/sso/complete` answers an expiry with its own error page. So the
 * details go to `sessionStorage` (this tab only) before every submit, and the page takes them back once, when it
 * opens again for the same address. They are only a convenience: a stale draft is dropped by age, and its domain
 * is checked again like a typed one.
 */

export interface SsoSetupValues {
  tenantName: string;
  tenantDomain: string;
}

interface StoredDraft extends SsoSetupValues {
  email: string;
  savedAt: number;
}

export const SSO_SETUP_DRAFT_KEY = 'of_sso_setup_draft';

/** Long enough for a new sign-in, short enough that a draft from an earlier attempt does not come back. */
export const SSO_SETUP_DRAFT_MAX_AGE_MS = 60 * 60 * 1000;

export function saveSsoSetupDraft(email: string, values: SsoSetupValues): void {
  try {
    const draft: StoredDraft = { email, ...values, savedAt: Date.now() };
    sessionStorage.setItem(SSO_SETUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // No storage means no draft: the user types the details again, as before.
  }
}

/** The draft saved for `email`, read once: it is removed from storage whether it matches or not. */
export function takeSsoSetupDraft(email: string): SsoSetupValues | null {
  try {
    const raw = sessionStorage.getItem(SSO_SETUP_DRAFT_KEY);
    sessionStorage.removeItem(SSO_SETUP_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<StoredDraft>;
    if (
      draft.email !== email ||
      typeof draft.tenantName !== 'string' ||
      typeof draft.tenantDomain !== 'string' ||
      typeof draft.savedAt !== 'number' ||
      Date.now() - draft.savedAt > SSO_SETUP_DRAFT_MAX_AGE_MS
    ) {
      return null;
    }
    return { tenantName: draft.tenantName, tenantDomain: draft.tenantDomain };
  } catch {
    return null;
  }
}
