'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { KnowledgeBaseView } from './components/knowledge-base-view';

export default function KnowledgeBasePage() {
  return (
    <ContentErrorBoundary title="Knowledge Base" message="Couldn't load the knowledge base.">
      <KnowledgeBaseView folderId={null} />
    </ContentErrorBoundary>
  );
}
