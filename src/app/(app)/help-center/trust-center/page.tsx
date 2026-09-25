'use client';

import { TrustCenterPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages';
import { EP, HELP_CENTER_BASE } from '../endpoints';

/**
 * Trust Center — one-line mount of the lib's ready-made `<TrustCenterPage>`
 * (PageLayout chrome + monitoring status + frameworks + tabs, self-fetching the
 * hub's public Vanta projection through the `/content` proxy). Gated-document
 * requests use the lib ContactForm, which reads `HELP_CENTER_ENDPOINTS.contactUrl`
 * from the Help Center subtree's EndpointsRuntime. `shell={false}` because
 * `AppLayout` already provides the page `<main>`.
 */
export default function TrustCenterRoute() {
  return (
    <TrustCenterPage
      shell={false}
      endpoint={EP.trustCenter}
      backButton={{ label: 'Back to Help Center', href: HELP_CENTER_BASE }}
    />
  );
}
