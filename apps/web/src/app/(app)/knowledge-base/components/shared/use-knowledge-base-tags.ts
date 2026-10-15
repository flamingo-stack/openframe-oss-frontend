'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useKnowledgeBaseTagsQuery as UseKnowledgeBaseTagsQueryType } from '@/__generated__/useKnowledgeBaseTagsQuery.graphql';
import { type SelectableTag, useRetryKey } from '@/app/components/shared';
import type { AssignedArticlesTarget } from '../assigned-articles/assigned-articles-target';

/**
 * The tags assigned to the articles under a folder, to the archived ones, or to the
 * articles assigned to a customer or device — what the list can be filtered by. One query behind both filter surfaces (the tag row
 * and the phone's modal), so mounting the two costs one request.
 */
const useKnowledgeBaseTagsQuery = graphql`
  query useKnowledgeBaseTagsQuery($folderId: ID, $archived: Boolean, $assignedTo: AssignmentTargetInput) {
    knowledgeBaseTags(folderId: $folderId, archived: $archived, assignedTo: $assignedTo) {
      id
      key
    }
  }
`;

/**
 * `assignedTo` takes precedence over the folder and the archive on the server, so a
 * caller passing it leaves those two at their defaults. `refreshKey` asks again after
 * an assign or unassign, which can change the set.
 */
export function useKnowledgeBaseTags(
  folderId: string | null,
  archived: boolean,
  assignedTo: AssignedArticlesTarget | null = null,
  refreshKey = 0,
): SelectableTag[] {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<UseKnowledgeBaseTagsQueryType>(
    useKnowledgeBaseTagsQuery,
    {
      folderId,
      archived: archived ? true : null,
      assignedTo: assignedTo ? { targetType: assignedTo.targetType, targetId: assignedTo.targetId } : null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: `${retryKey}:${refreshKey}` },
  );
  return data.knowledgeBaseTags.map(tag => ({ id: tag.id, key: tag.key }));
}
