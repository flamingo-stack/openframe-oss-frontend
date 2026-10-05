'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql, useRelayEnvironment } from 'react-relay';
import {
  commitLocalUpdate,
  commitMutation,
  type GraphQLTaggedNode,
  type IEnvironment,
  type MutationParameters,
  type SelectorStoreUpdater,
} from 'relay-runtime';
import type { useSaveArticleAddTagMutation as AddTagMutationType } from '@/__generated__/useSaveArticleAddTagMutation.graphql';
import type { useSaveArticleCreateMutation as CreateMutationType } from '@/__generated__/useSaveArticleCreateMutation.graphql';
import type { useSaveArticleDeleteAttachmentMutation as DeleteAttachmentMutationType } from '@/__generated__/useSaveArticleDeleteAttachmentMutation.graphql';
import type { useSaveArticleLinkAttachmentsMutation as LinkAttachmentsMutationType } from '@/__generated__/useSaveArticleLinkAttachmentsMutation.graphql';
import type { useSaveArticleMoveMutation as MoveMutationType } from '@/__generated__/useSaveArticleMoveMutation.graphql';
import type { useSaveArticlePublishMutation as PublishMutationType } from '@/__generated__/useSaveArticlePublishMutation.graphql';
import type { useSaveArticleRemoveTagMutation as RemoveTagMutationType } from '@/__generated__/useSaveArticleRemoveTagMutation.graphql';
import type { useSaveArticleUnarchiveMutation as UnarchiveMutationType } from '@/__generated__/useSaveArticleUnarchiveMutation.graphql';
import type { useSaveArticleUnpublishMutation as UnpublishMutationType } from '@/__generated__/useSaveArticleUnpublishMutation.graphql';
import type { useSaveArticleUpdateMutation as UpdateMutationType } from '@/__generated__/useSaveArticleUpdateMutation.graphql';
import { isOptimisticTagId } from '@/app/components/shared/tags';
import { useApplyAssignmentsDiff } from '@/components/assignments';
import { KnowledgeBaseArticleStatus } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import {
  invalidateArchiveListing,
  invalidateFolderListing,
  removeFromFolderListing,
} from '../shared/knowledge-base-listings';
import type { StoredArticle } from './article-form-record';
import type { ArticleFormData } from './article-form.types';

/**
 * TODO(oss-lib#2545): this whole file becomes one `useMutation`. That backend's
 * `updateArticle` takes `status`, `tagIds`, the four `assigned*Ids`,
 * `attachmentTempIds`, `deleteAttachmentIds` and `moveToRoot`; `createArticle`
 * takes `attachmentTempIds`. `SaveArticleRequest` is already that input — `stored`
 * and every step below go. Then invalidate the assignments' react-query cache
 * (`['assignments', 'assigned-items']`) in `onCompleted`.
 *
 * Until then a save is several requests, and this file is the one place that
 * knows it. Nothing can be rolled back, so what can be repeated goes first and
 * what cannot be undone goes last: tags, assignments and new attachments → the
 * text → the folder → the status → the deletions.
 */

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
  /** The article as it was loaded — what the steps below are worked out against. Null when creating. */
  stored: StoredArticle | null;
}

const createMutation = graphql`
  mutation useSaveArticleCreateMutation($input: CreateArticleInput!) {
    createArticle(input: $input) {
      id
    }
  }
`;

const updateMutation = graphql`
  mutation useSaveArticleUpdateMutation($input: UpdateArticleInput!) {
    updateArticle(input: $input) {
      id
      name
      content
      summary
      updatedAt
    }
  }
`;

const moveMutation = graphql`
  mutation useSaveArticleMoveMutation($id: ID!, $parentId: ID) {
    moveToFolder(id: $id, parentId: $parentId) {
      id
      parentId
      updatedAt
    }
  }
`;

const addTagMutation = graphql`
  mutation useSaveArticleAddTagMutation($itemId: ID!, $tagId: ID!) {
    addTagToKnowledgeBaseItem(itemId: $itemId, tagId: $tagId) {
      id
      tags {
        id
        key
        color
      }
    }
  }
`;

const removeTagMutation = graphql`
  mutation useSaveArticleRemoveTagMutation($itemId: ID!, $tagId: ID!) {
    removeTagFromKnowledgeBaseItem(itemId: $itemId, tagId: $tagId) {
      id
      tags {
        id
        key
        color
      }
    }
  }
`;

const linkAttachmentsMutation = graphql`
  mutation useSaveArticleLinkAttachmentsMutation($input: LinkKnowledgeBaseTempAttachmentsInput!) {
    linkKnowledgeBaseTempAttachmentsToArticle(input: $input) {
      id
    }
  }
`;

const deleteAttachmentMutation = graphql`
  mutation useSaveArticleDeleteAttachmentMutation($input: MutationDeleteInput!) {
    deleteKnowledgeBaseAttachment(input: $input) {
      userErrors {
        message
      }
    }
  }
`;

const publishMutation = graphql`
  mutation useSaveArticlePublishMutation($id: ID!) {
    publishArticle(id: $id) {
      id
      status
      publishedAt
      updatedAt
    }
  }
`;

const unpublishMutation = graphql`
  mutation useSaveArticleUnpublishMutation($id: ID!) {
    unpublishArticle(id: $id) {
      id
      status
      publishedAt
      updatedAt
    }
  }
`;

const unarchiveMutation = graphql`
  mutation useSaveArticleUnarchiveMutation($id: ID!, $parentId: ID) {
    unarchiveArticle(id: $id, parentId: $parentId) {
      id
      status
      parentId
      updatedAt
    }
  }
`;

/** One step of the save, awaited — the steps have to run in order. */
function commit<TMutation extends MutationParameters>(
  environment: IEnvironment,
  mutation: GraphQLTaggedNode,
  variables: TMutation['variables'],
  updater?: SelectorStoreUpdater<TMutation['response']>,
): Promise<TMutation['response']> {
  return new Promise((resolve, reject) => {
    commitMutation<TMutation>(environment, {
      mutation,
      variables,
      updater,
      onCompleted: (response, errors) => {
        const [error] = errors ?? [];
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(response);
        }
      },
      onError: reject,
    });
  });
}

/** `useApplyAssignmentsDiff` reports its own failure; this keeps the save from reporting it a second time. */
class ReportedError extends Error {}

type ApplyAssignments = ReturnType<typeof useApplyAssignmentsDiff>['mutateAsync'];

interface SaveOutcome {
  articleId: string;
  /** The article is saved, but not all of it — said to the user without keeping them on the form. */
  warning?: string;
}

/** The article's summary is the head of its text: what the list shows under the name, and what search reads. */
function summaryOf(body: string): string {
  return body.slice(0, 160);
}

/** Tags are created as they are picked; one whose creation is still in flight has no id the server knows. */
function savedTagIds(values: ArticleFormData): string[] {
  return values.tags.filter(id => !isOptimisticTagId(id));
}

async function createArticle(
  environment: IEnvironment,
  request: SaveArticleRequest,
  applyAssignments: ApplyAssignments,
): Promise<SaveOutcome> {
  const { values, status, attachmentTempIds } = request;
  const { createArticle: created } = await commit<CreateMutationType>(
    environment,
    createMutation,
    {
      input: {
        name: values.title,
        parentId: values.folderId,
        content: values.body,
        summary: summaryOf(values.body),
        status,
        tagIds: savedTagIds(values),
      },
    },
    store => invalidateFolderListing(store, values.folderId),
  );
  const articleId = created.id;

  // The article exists from here on. A failure below must not send the user back
  // to a form whose Save would create it a second time.
  try {
    if (attachmentTempIds.length > 0) {
      await commit<LinkAttachmentsMutationType>(environment, linkAttachmentsMutation, {
        input: { articleId, tempIds: attachmentTempIds },
      });
    }
    if (Object.keys(values.assignments ?? {}).length > 0) {
      await applyAssignments({
        itemId: articleId,
        itemType: 'KNOWLEDGE_ARTICLE',
        prev: {},
        next: values.assignments ?? {},
      });
    }
  } catch {
    return { articleId, warning: 'The article was created, but its attachments or assignments were not saved.' };
  }
  return { articleId };
}

async function updateArticle(
  environment: IEnvironment,
  request: SaveArticleRequest & { articleId: string; stored: StoredArticle },
  applyAssignments: ApplyAssignments,
): Promise<SaveOutcome> {
  const { articleId, values, status, attachmentTempIds, deleteAttachmentIds, stored } = request;

  const tagIds = savedTagIds(values);
  const tagsBefore = new Set(stored.values.tags);
  const tagsAfter = new Set(tagIds);
  await Promise.all([
    ...tagIds
      .filter(tagId => !tagsBefore.has(tagId))
      .map(tagId => commit<AddTagMutationType>(environment, addTagMutation, { itemId: articleId, tagId })),
    ...stored.values.tags
      .filter(tagId => !tagsAfter.has(tagId))
      .map(tagId => commit<RemoveTagMutationType>(environment, removeTagMutation, { itemId: articleId, tagId })),
    applyAssignments({
      itemId: articleId,
      itemType: 'KNOWLEDGE_ARTICLE',
      prev: stored.values.assignments ?? {},
      next: values.assignments ?? {},
    }).catch(() => {
      throw new ReportedError();
    }),
  ]);

  if (attachmentTempIds.length > 0) {
    await commit<LinkAttachmentsMutationType>(environment, linkAttachmentsMutation, {
      input: { articleId, tempIds: attachmentTempIds },
    });
  }

  await commit<UpdateMutationType>(environment, updateMutation, {
    input: { id: articleId, name: values.title, content: values.body, summary: summaryOf(values.body) },
  });

  if (stored.status === KnowledgeBaseArticleStatus.ARCHIVED) {
    // The only way out of the archive: it restores the article as published, into the folder picked.
    await commit<UnarchiveMutationType>(
      environment,
      unarchiveMutation,
      { id: articleId, parentId: values.folderId },
      store => {
        invalidateArchiveListing(store);
        invalidateFolderListing(store, values.folderId);
      },
    );
    if (status === KnowledgeBaseArticleStatus.DRAFT) {
      await commit<UnpublishMutationType>(environment, unpublishMutation, { id: articleId });
    }
  } else {
    if (values.folderId !== stored.values.folderId) {
      // `moveToFolder`, not `updateArticle.parentId`: there a null means "leave it", so a move to the root is lost.
      await commit<MoveMutationType>(environment, moveMutation, { id: articleId, parentId: values.folderId }, store => {
        removeFromFolderListing(store, stored.values.folderId, articleId);
        invalidateFolderListing(store, values.folderId);
      });
    }
    if (status !== stored.status) {
      await (status === KnowledgeBaseArticleStatus.PUBLISHED
        ? commit<PublishMutationType>(environment, publishMutation, { id: articleId })
        : commit<UnpublishMutationType>(environment, unpublishMutation, { id: articleId }));
    }
  }

  const deletions = await Promise.allSettled(
    deleteAttachmentIds.map(async id => {
      const { deleteKnowledgeBaseAttachment: payload } = await commit<DeleteAttachmentMutationType>(
        environment,
        deleteAttachmentMutation,
        { input: { id } },
      );
      const [refusal] = payload.userErrors;
      if (refusal) throw new Error(refusal.message);
    }),
  );

  // None of the attachment steps answers with the article, so the store still
  // holds the old list. Marked stale, the article's page loads it fresh instead
  // of painting that list first.
  if (attachmentTempIds.length > 0 || deleteAttachmentIds.length > 0) {
    commitLocalUpdate(environment, store => store.get(articleId)?.invalidateRecord());
  }

  const undeleted = deletions.filter(result => result.status === 'rejected').length;
  return undeleted > 0
    ? { articleId, warning: 'The article was saved, but some attachments could not be removed.' }
    : { articleId };
}

export function useSaveArticle() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const { mutateAsync: applyAssignments } = useApplyAssignmentsDiff();
  const [isSaving, setIsSaving] = useState(false);

  const save = (request: SaveArticleRequest, onSaved: (articleId: string) => void) => {
    const { articleId, stored } = request;
    // An article that is still loading has nothing to be saved against — and must
    // never fall through to the branch that creates one.
    if (articleId !== null && !stored) return;

    setIsSaving(true);
    const saving =
      articleId !== null && stored
        ? updateArticle(environment, { ...request, articleId, stored }, applyAssignments)
        : createArticle(environment, request, applyAssignments);

    void saving
      .then(
        outcome => {
          if (outcome.warning) {
            toast({ title: 'Warning', description: outcome.warning, variant: 'destructive' });
          }
          onSaved(outcome.articleId);
        },
        (error: unknown) => {
          if (error instanceof ReportedError) return;
          toast({
            title: 'Save failed',
            description: getRelayErrorMessage(error, 'Unable to save article'),
            variant: 'destructive',
          });
        },
      )
      .finally(() => setIsSaving(false));
  };

  return { save, isSaving };
}
