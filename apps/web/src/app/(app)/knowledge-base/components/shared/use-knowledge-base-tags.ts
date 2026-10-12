'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useKnowledgeBaseTagsQuery as UseKnowledgeBaseTagsQueryType } from '@/__generated__/useKnowledgeBaseTagsQuery.graphql';
import { type SelectableTag, useRetryKey } from '@/app/components/shared';

/**
 * The tags assigned to the articles under a folder, or to the archived ones — what
 * the list can be filtered by. One query behind both filter surfaces (the tag row
 * and the phone's modal), so mounting the two costs one request.
 */
const useKnowledgeBaseTagsQuery = graphql`
  query useKnowledgeBaseTagsQuery($folderId: ID, $archived: Boolean) {
    knowledgeBaseTags(folderId: $folderId, archived: $archived) {
      id
      key
    }
  }
`;

export function useKnowledgeBaseTags(folderId: string | null, archived: boolean): SelectableTag[] {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<UseKnowledgeBaseTagsQueryType>(
    useKnowledgeBaseTagsQuery,
    { folderId, archived: archived ? true : null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return data.knowledgeBaseTags.map(tag => ({ id: tag.id, key: tag.key }));
}
