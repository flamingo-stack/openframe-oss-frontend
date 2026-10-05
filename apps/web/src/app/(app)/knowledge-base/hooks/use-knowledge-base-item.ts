'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useKnowledgeBaseItemQuery as UseKnowledgeBaseItemQueryType } from '@/__generated__/useKnowledgeBaseItemQuery.graphql';
import { useRetryKey } from '@/app/components/shared';

export const knowledgeBaseItemQuery = graphql`
  query useKnowledgeBaseItemQuery($id: ID!) {
    knowledgeBaseItem(id: $id) {
      id
      type
      name
      parentId
      slug
      content
      summary
      status
      publishedAt
      createdAt
      updatedAt
      author {
        id
        firstName
        lastName
        email
        status
        image {
          imageUrl
          hash
        }
      }
      tags {
        id
        key
        color
      }
      attachments {
        id
        fileName
        fileSize
        contentType
        createdAt
      }
    }
  }
`;

export type KnowledgeBaseItemNode = NonNullable<UseKnowledgeBaseItemQueryType['response']['knowledgeBaseItem']>;

export function useKnowledgeBaseItem(id: string) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<UseKnowledgeBaseItemQueryType>(
    knowledgeBaseItemQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return data.knowledgeBaseItem;
}
