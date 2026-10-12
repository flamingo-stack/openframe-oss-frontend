'use client';

import { ArchivedArticlesView } from '../components/archive/archived-articles-view';
import { KnowledgeBasePageShell } from '../components/shared/knowledge-base-page-shell';

export default function ArchivePage() {
  return (
    <KnowledgeBasePageShell errorMessage="Couldn't load the archive.">
      <ArchivedArticlesView />
    </KnowledgeBasePageShell>
  );
}
