/**
 * Row labels of the "INTEGRATION" section, in its order (Figma 2097-140910). Data-only, read by the
 * live section and its skeleton, so the loading card draws the real labels and neither drifts. The
 * directory id's label is the provider's (`providerPresentation`), so it is not here.
 */
export const INTEGRATION_LABELS = {
  primaryDomain: 'Primary domain',
  grantedBy: 'Granted by',
  scopes: 'Scopes held',
  authorisedBy: 'Authorised by',
  domains: 'Additional domains',
} as const;
