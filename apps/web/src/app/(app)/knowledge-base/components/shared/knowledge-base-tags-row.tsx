'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type SelectableTag, SelectableTagsRow, NO_ITEMS } from '@/app/components/shared';
import { useKnowledgeBaseTags } from './use-knowledge-base-tags';

interface KnowledgeBaseTagsRowProps {
  parentId: string | null;
  archived: boolean;
  selectedIds: ReadonlyArray<string>;
  onAdd: (tag: SelectableTag) => void;
}

/**
 * The tags the list can still be filtered by, as one row of chips. Suspends on the tags; in a loading scope (the
 * toolbar's Suspense fallback) the row draws its own loading state and reads nothing.
 */
export function KnowledgeBaseTagsRow(props: KnowledgeBaseTagsRowProps) {
  if (useLoadingScope()) {
    return <SelectableTagsRow tags={NO_ITEMS} selectedIds={props.selectedIds} onAdd={props.onAdd} />;
  }
  return <KnowledgeBaseTagsRowQuery {...props} />;
}

function KnowledgeBaseTagsRowQuery({ parentId, archived, selectedIds, onAdd }: KnowledgeBaseTagsRowProps) {
  const tags = useKnowledgeBaseTags(parentId, archived);
  return <SelectableTagsRow tags={tags} selectedIds={selectedIds} onAdd={onAdd} />;
}
