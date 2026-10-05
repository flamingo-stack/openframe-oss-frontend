'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { KnowledgeBaseView } from '../components/knowledge-base-view';

export default function FolderPage() {
  const id = useSearchParams().get('id');
  if (!id) {
    notFound();
  }
  return (
    <ContentErrorBoundary title="Knowledge Base" message="Couldn't load this folder.">
      <KnowledgeBaseView folderId={id} />
    </ContentErrorBoundary>
  );
}
