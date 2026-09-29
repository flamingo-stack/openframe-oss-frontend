'use client';

// The Microsoft seam. Microsoft 365 consents through an admin-consent LINK like Google
// (`login.microsoftonline.com/<domain>/v2.0/adminconsent?…`, confirmed on the feature env),
// so today it is the shared link panel; replace this body alone if Microsoft ever diverges.

export { ConsentLinkPanel as MicrosoftConsentPanel } from './consent-link-panel';
