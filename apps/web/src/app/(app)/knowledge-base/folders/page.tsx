'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { KnowledgeBaseView } from '../components/item-list/knowledge-base-view';
import { KnowledgeBasePageShell } from '../components/shared/knowledge-base-page-shell';

export default function FolderPage() {
  const id = useSearchParams().get('id');
  if (!id) {
    notFound();
  }
  return (
    <KnowledgeBasePageShell errorMessage="Couldn't load this folder." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      <KnowledgeBaseView key={id} folderId={id} />
    </KnowledgeBasePageShell>
  );
}
