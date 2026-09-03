/**
 * Public legal pages linked from the consent copy on every registration surface.
 *
 * Centralised because the auth screens each render their own `TermsAgreementLabel` and a link that
 * silently drifts on one of them is the kind of thing nobody notices until legal does.
 */
export const TERMS_URL = 'https://www.flamingo.run/terms-of-service';

export const PRIVACY_POLICY_URL = 'https://www.flamingo.run/privacy-policy';
