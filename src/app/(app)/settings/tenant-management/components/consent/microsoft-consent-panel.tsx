'use client';

// The Microsoft seam (ASSUMPTIONS A1). The Figma frames draw a Microsoft 365
// consent LINK (`login.microsoftonline.com/{domain}/adminconsent?…`) and that is
// what this renders. The provider API behind it moved to exactly that model on
// 2026-09-11 (`startMicrosoft365Consent(tiers) → authorizationUrl`, no client
// id/secret any more); the FE facade this module is typed against predates the
// change, so on it `DirectoryConnection.consentUrl` is still null for Microsoft
// until the facade is rebased. Open: whether `msTenantId` takes the verified
// domain the form collects or needs the directory GUID.
//
// This file is the one place that changes if Microsoft ever needs a different
// body (per-tier consent, a tenant-id field): keep the `ConsentPanelProps`
// contract, replace the body, and no page has to know. Until then it is the
// shared link panel under Microsoft's own copy.

export { ConsentLinkPanel as MicrosoftConsentPanel } from './consent-link-panel';
