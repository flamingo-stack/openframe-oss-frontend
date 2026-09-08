/**
 * Public legal pages linked from every auth surface: the consent copy on the registration forms and
 * the "Terms of Service • Privacy Policy" row at the foot of the login card.
 *
 * Centralised because each screen renders its own links, and one that silently drifts is the kind of
 * thing nobody notices until legal does.
 */
export const TERMS_URL = 'https://www.flamingo.run/terms-of-service';

export const PRIVACY_POLICY_URL = 'https://www.flamingo.run/privacy-policy';
