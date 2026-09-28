'use client';

import { TrustCenterPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages';
import { EP, HELP_CENTER_BASE } from '../endpoints';

/**
 * Trust Center — one-line mount of the lib's ready-made `<TrustCenterPage>`
 * (PageLayout chrome + monitoring status + one anchored page of sections with a
 * section rail, self-fetching the hub's public Vanta projection through the
 * `/content` proxy; documents, subprocessors and AI statements are the hub's
 * projection of the Vanta Trust Center, a public file opening through the same proxy).
 * Gated-document requests use the lib ContactForm, which reads
 * `HELP_CENTER_ENDPOINTS.contactUrl` from the Help Center subtree's
 * EndpointsRuntime. `shell={false}` because `AppLayout` already provides the
 * page `<main>`.
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
