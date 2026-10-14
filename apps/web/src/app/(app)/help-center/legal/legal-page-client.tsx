'use client';

import { LegalDocumentPage, useLegalDocuments } from '@flamingo-stack/openframe-frontend-core/components';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';
import { EP, HELP_CENTER_BASE, pageFaq } from '../endpoints';

/** The document the Help Center's Legal card opens on. */
const DEFAULT_DOC_TYPE = 'privacy';

/**
 * One page for every legal document. The hub serves each document with its own
 * title, version and effective date and lists them all, so this page states no
 * per-document copy and names no document: the switcher shows every document
 * the hub has published, and one it adds appears here with no change.
 */
export function LegalPageClient({ docType: requested }: { docType: string }) {
  const router = useRouter();
  const docType = requested || DEFAULT_DOC_TYPE;
  // The FAQ topic of the document is the hub's too (the list carries it).
  const { documents } = useLegalDocuments({ apiEndpoint: EP.legalDocuments });
  const faqTopic = documents.find(doc => doc.docType === docType)?.faqTopic;

  return (
    <LegalDocumentPage
      shell={false}
      docType={docType}
      apiEndpoint={EP.legal(docType)}
      documents={{ apiEndpoint: EP.legalDocuments, onSelect: next => router.push(routes.helpCenter.legal(next)) }}
      backButton={{ label: 'Back to Help Center', href: HELP_CENTER_BASE }}
      faq={faqTopic ? pageFaq(faqTopic) : undefined}
    />
  );
}
