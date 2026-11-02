/**
 * Public legal pages: the consent copy on the registration forms, the "Terms of Service • Privacy
 * Policy" row at the foot of the login card, and the billing page's explanation of a device charge.
 *
 * Centralised because each screen renders its own links, and one that silently drifts is the kind of
 * thing nobody notices until legal does.
 */
export const TERMS_URL = 'https://www.flamingo.run/terms-of-service';

export const PRIVACY_POLICY_URL = 'https://www.flamingo.run/privacy-policy';

/** Payment Terms, at the section that says how devices are counted and billed. */
export const DEVICE_BILLING_TERMS_URL = 'https://www.flamingo.run/payment-terms#3-plans-and-what-you-pay-for';
