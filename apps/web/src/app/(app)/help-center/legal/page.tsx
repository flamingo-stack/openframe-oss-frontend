'use client';

import { useSearchParams } from 'next/navigation';
import { LegalPageClient } from './legal-page-client';

/**
 * A legal document. Which one is a QUERY param, not a path segment: the
 * documents are the hub's list (`EP.legalDocuments`), so `output: 'export'`
 * cannot prerender one page per document (see `routes.helpCenter.legal`).
 */
export default function LegalRoute() {
  const docType = useSearchParams().get('doc') ?? '';
  return <LegalPageClient docType={docType} />;
}
