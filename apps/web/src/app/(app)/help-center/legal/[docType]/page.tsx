import { LEGAL_DOCUMENT_TYPES } from '@flamingo-stack/openframe-frontend-core/utils';
import { LegalPageClient } from './legal-page-client';

// One page per legal document. The types are enumerable (the lib's list of the
// types a hub can publish), so `output: 'export'` prerenders each of them.
// generateStaticParams is server-only; the rendering lives in the client child.
export function generateStaticParams() {
  return LEGAL_DOCUMENT_TYPES.map(docType => ({ docType }));
}

export default function LegalPage() {
  return <LegalPageClient />;
}
