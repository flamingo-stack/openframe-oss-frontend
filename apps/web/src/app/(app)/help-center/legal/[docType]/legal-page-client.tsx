'use client';

import { LegalDocumentPage, useLegalDocuments } from '@flamingo-stack/openframe-frontend-core/components';
import { useParams } from 'next/navigation';
import { EP, HELP_CENTER_BASE, pageFaq } from '../../endpoints';

/**
 * One legal document's page. The hub serves the document with its own title,
 * version and effective date, so this page states no per-document copy, and a
 * type the hub has not published says so instead of showing another document.
 */
export function LegalPageClient() {
  const { docType } = useParams<{ docType: string }>();
  // The FAQ topic of the document is the hub's too (its list carries it).
  const { documents } = useLegalDocuments({ apiEndpoint: EP.legalDocuments });
  const faqTopic = documents.find(doc => doc.docType === docType)?.faqTopic;

  return (
    <LegalDocumentPage
      shell={false}
      docType={docType}
      apiEndpoint={EP.legal(docType)}
      backButton={{ label: 'Back to Help Center', href: HELP_CENTER_BASE }}
      faq={faqTopic ? pageFaq(faqTopic) : undefined}
    />
  );
}
