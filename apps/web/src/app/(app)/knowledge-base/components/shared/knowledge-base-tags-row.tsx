'use client';

import { type SelectableTag, SelectableTagsRow } from '@/app/components/shared';
import { useKnowledgeBaseTags } from './use-knowledge-base-tags';

interface KnowledgeBaseTagsRowProps {
  parentId: string | null;
  archived: boolean;
  selectedIds: ReadonlyArray<string>;
  onAdd: (tag: SelectableTag) => void;
}

/** The tags the list can still be filtered by, as one row of chips. Suspends on the tags. */
export function KnowledgeBaseTagsRow({ parentId, archived, selectedIds, onAdd }: KnowledgeBaseTagsRowProps) {
  const tags = useKnowledgeBaseTags(parentId, archived);
  return <SelectableTagsRow tags={tags} selectedIds={selectedIds} onAdd={onAdd} />;
}
