import { LEGAL_DOCUMENT_TYPES, type LegalDocumentType } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * The legal documents the Help Center has a card and a page for.
 *
 * Every type the hub can publish, except in the phone apps: Payment Terms set out the plans, the free trial and
 * prices, and a store app shows none of them (`isBillingHidden()`). This covers the Help Center's own card and page;
 * other copies of the text (the Knowledge Base, links in other documents) are hub content.
 */
export function shownLegalDocumentTypes(billingHidden: boolean): readonly LegalDocumentType[] {
  return billingHidden ? LEGAL_DOCUMENT_TYPES.filter(docType => docType !== 'payment') : LEGAL_DOCUMENT_TYPES;
}
