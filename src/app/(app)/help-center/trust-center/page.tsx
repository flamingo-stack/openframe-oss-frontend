'use client';

import { TrustCenterPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages';
import type { TrustCenterDocument } from '@flamingo-stack/openframe-frontend-core/types';
import { isHelpCenterLegalDoc, routes } from '@/lib/routes';
import { EP, HELP_CENTER_BASE } from '../endpoints';

/** Public legal documents open our in-app Help Center legal page, not the hub's. */
function documentHref(document: TrustCenterDocument): string | null {
  return isHelpCenterLegalDoc(document.legalDocType)
    ? routes.helpCenter.legal(document.legalDocType)
    : (document.url ?? null);
}

/**
 * Trust Center — one-line mount of the lib's ready-made `<TrustCenterPage>`
 * (PageLayout chrome + monitoring status + one anchored page of sections with a
 * section rail, self-fetching the hub's public Vanta projection through the
 * `/content` proxy). Public legal documents route to `routes.helpCenter.legal`.
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
      documentHref={documentHref}
      backButton={{ label: 'Back to Help Center', href: HELP_CENTER_BASE }}
    />
  );
}
