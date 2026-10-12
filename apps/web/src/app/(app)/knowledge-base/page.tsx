'use client';

import { KnowledgeBaseView } from './components/item-list/knowledge-base-view';
import { KnowledgeBasePageShell } from './components/shared/knowledge-base-page-shell';

export default function KnowledgeBasePage() {
  return (
    <KnowledgeBasePageShell errorMessage="Couldn't load the knowledge base.">
      <KnowledgeBaseView folderId={null} />
    </KnowledgeBasePageShell>
  );
}
