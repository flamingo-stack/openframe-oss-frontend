'use client';

import { FaqDocumentPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages';
import { HELP_CENTER_BASE } from '../endpoints';

/**
 * FAQs — one-line mount of the lib's ready-made `<FaqDocumentPage>`. It routes
 * the title + subtitle through the unified `PageLayout` header (`titleSize="h1"`,
 * same as every other help-center page) and self-fetches the Help Center's FAQ
 * endpoint (`CONTENT_ENDPOINTS.faqsUrl`), so this page only supplies copy + the back
 * target. `shell={false}` because `AppLayout` already provides the page `<main>`.
 */
export default function FaqsRoute() {
  return (
    <FaqDocumentPage
      shell={false}
      subtitle="Answers to the most common questions about OpenFrame."
      backButton={{ label: 'Back to Help Center', href: HELP_CENTER_BASE }}
    />
  );
}
