'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { graphql, useMutation } from 'react-relay';
import type { useSaveArticleCreateMutation as CreateMutationType } from '@/__generated__/useSaveArticleCreateMutation.graphql';
import type { useSaveArticleUpdateMutation as UpdateMutationType } from '@/__generated__/useSaveArticleUpdateMutation.graphql';
import { isOptimisticTagId } from '@/app/components/shared/tags';
import { ASSIGNED_ITEMS_QUERY_KEY, assignedTargetIds } from '@/components/assignments';
import { KnowledgeBaseArticleStatus } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import {
  invalidateArchiveListing,
  invalidateFolderListing,
  moveBetweenFolders,
} from '../shared/knowledge-base-listings';
import type { StoredArticle } from './article-form-record';
import type { ArticleFormData } from './article-form.types';

/** What Save can leave an article as. The archive is entered from the article's own page. */
export type SaveStatus = typeof KnowledgeBaseArticleStatus.DRAFT | typeof KnowledgeBaseArticleStatus.PUBLISHED;

export interface SaveArticleRequest {
  /** The article saved; null creates one. */
  articleId: string | null;
  values: ArticleFormData;
  status: SaveStatus;
  /** Uploaded files to attach. */
  attachmentTempIds: string[];
  /** The article's own files to delete. */
  deleteAttachmentIds: string[];
  /**
   * The article as it was loaded: what tells a changed assignment list from an
   * untouched one, and which listings the save takes the article out of. Null
   * when creating.
   */
  stored: StoredArticle | null;
}

const createMutation = graphql`
  mutation useSaveArticleCreateMutation($input: CreateArticleInput!) {
    createArticle(input: $input) {
      id
    }
  }
`;

// The answer is everything a save can change, so the article's page and its row
// in a list are current without a second request.
const updateMutation = graphql`
  mutation useSaveArticleUpdateMutation($input: UpdateArticleInput!) {
    updateArticle(input: $input) {
      id
      name
      content
      summary
      status
      publishedAt
      updatedAt
      parentId
      parent {
        name
      }
      author {
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
      }
    }
  }
`;

/** The most ids the server takes in one list of a save. */
const MAX_ASSIGNED_PER_KIND = 50;

/** The article's summary is the head of its text: what the list shows under the name, and what search reads. */
function summaryOf(body: string): string {
  return body.slice(0, 160);
}

/** Tags are created as they are picked; one whose creation is still in flight has no id the server knows. */
function savedTagIds(values: ArticleFormData): string[] {
  return values.tags.filter(id => !isOptimisticTagId(id));
}

/**
 * Saves the article form in one mutation: the text, the folder, the status, the
 * tags, the assignments and the attachments go together. The server orders the
 * writes so that a failure leaves the article as it was or is fixed by pressing
 * Save again — there is nothing to reconcile here.
 */
export function useSaveArticle() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commitCreate, isCreating] = useMutation<CreateMutationType>(createMutation);
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateMutation);

  const save = (request: SaveArticleRequest, onSaved: (articleId: string) => void) => {
    const { articleId, values, status, attachmentTempIds, deleteAttachmentIds, stored } = request;

    // Only the kinds that changed: an untouched one is left to the server.
    const assigned = assignedTargetIds(values.assignments, stored?.values.assignments);
    if (Object.values(assigned).some(ids => ids.length > MAX_ASSIGNED_PER_KIND)) {
      toast({
        title: 'Save failed',
        description: `An article can be assigned to at most ${MAX_ASSIGNED_PER_KIND} items of one kind.`,
        variant: 'destructive',
      });
      return;
    }

    const article = {
      name: values.title,
      content: values.body,
      summary: summaryOf(values.body),
      status,
      tagIds: savedTagIds(values),
      attachmentTempIds,
      ...assigned,
    };
    const onCompleted = (savedId: string) => {
      // The article's page reads what it is assigned to through react-query.
      void queryClient.invalidateQueries({ queryKey: ASSIGNED_ITEMS_QUERY_KEY });
      onSaved(savedId);
    };
    const onError = (error: Error) => {
      toast({
        title: 'Save failed',
        description: getRelayErrorMessage(error, 'Unable to save article'),
        variant: 'destructive',
      });
    };

    if (articleId === null) {
      commitCreate({
        variables: { input: { ...article, parentId: values.folderId } },
        updater: store => invalidateFolderListing(store, values.folderId),
        onCompleted: ({ createArticle }) => onCompleted(createArticle.id),
        onError,
      });
      return;
    }

    // An article that is still loading has nothing to be saved over.
    if (!stored) return;

    commitUpdate({
      variables: {
        input: {
          id: articleId,
          ...article,
          // Always named, so the server checks the folder is still there. A null
          // parentId means "leave it", hence the flag for the root.
          ...(values.folderId ? { parentId: values.folderId } : { moveToRoot: true }),
          deleteAttachmentIds,
        },
      },
      updater: store => {
        if (stored.status === KnowledgeBaseArticleStatus.ARCHIVED) {
          // A status is what restores an archived article, as a draft or published.
          invalidateArchiveListing(store);
          invalidateFolderListing(store, values.folderId);
        } else {
          moveBetweenFolders(store, { itemId: articleId, from: stored.values.folderId, to: values.folderId });
        }
      },
      onCompleted: () => onCompleted(articleId),
      onError,
    });
  };

  return { save, isSaving: isCreating || isUpdating };
}
