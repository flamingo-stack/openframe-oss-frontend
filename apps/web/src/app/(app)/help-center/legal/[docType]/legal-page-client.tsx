'use client';

import { LegalDocumentPage } from '@flamingo-stack/openframe-frontend-core/components';
import { isLegalDocumentType } from '@flamingo-stack/openframe-frontend-core/utils';
import { notFound, useParams } from 'next/navigation';
import { isBillingHidden } from '@/lib/billing-visibility';
import { EP, HELP_CENTER_BASE } from '../../endpoints';
import { shownLegalDocumentTypes } from '../../legal-documents';

/**
 * One legal document's page. The lib page reads the document and the hub's list
 * of legal documents itself (title, version, effective date, FAQ topic), so this
 * page passes only the type and the endpoints and states nothing per document.
 */
export function LegalPageClient() {
  const { docType } = useParams<{ docType: string }>();
  // The export prerenders every type, so a document this build does not show still has a path to answer.
  if (isLegalDocumentType(docType) && !shownLegalDocumentTypes(isBillingHidden()).includes(docType)) {
    notFound();
  }
  return (
    <LegalDocumentPage
      shell={false}
      docType={docType}
      apiEndpoint={EP.legal(docType)}
      documentsEndpoint={EP.legalDocuments}
      backButton={{ label: 'Back to Help Center', href: HELP_CENTER_BASE }}
    />
  );
}
