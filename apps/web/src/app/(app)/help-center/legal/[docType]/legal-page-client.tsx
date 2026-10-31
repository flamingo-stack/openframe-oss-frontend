'use client';

import { LegalDocumentPage } from '@flamingo-stack/openframe-frontend-core/components';
import { useParams } from 'next/navigation';
import { EP, HELP_CENTER_BASE } from '../../endpoints';

/**
 * One legal document's page. The lib page reads the document and the hub's list
 * of legal documents itself (title, version, effective date, FAQ topic), so this
 * page passes only the type and the endpoints and states nothing per document.
 */
export function LegalPageClient() {
  const { docType } = useParams<{ docType: string }>();
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
