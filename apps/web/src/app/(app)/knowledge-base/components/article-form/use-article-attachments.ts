'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { useArticleAttachmentsCreateUploadMutation as CreateUploadMutationType } from '@/__generated__/useArticleAttachmentsCreateUploadMutation.graphql';
import type { useArticleAttachmentsDiscardUploadMutation as DiscardUploadMutationType } from '@/__generated__/useArticleAttachmentsDiscardUploadMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { putUploadSource, type UploadSource, uploadSourceMeta } from '@/lib/native-files';
import type { StoredAttachment } from './article-form-record';

// A file is uploaded before the article is saved: the server hands out a
// presigned URL for a TEMPORARY attachment, and the save attaches it for good.
const createUploadMutation = graphql`
  mutation useArticleAttachmentsCreateUploadMutation($input: CreateKnowledgeBaseTempAttachmentInput!) {
    createKnowledgeBaseTempAttachmentUploadUrl(input: $input) {
      tempAttachment {
        id
        uploadUrl
      }
      userErrors {
        message
      }
    }
  }
`;

const discardUploadMutation = graphql`
  mutation useArticleAttachmentsDiscardUploadMutation($input: MutationDeleteInput!) {
    deleteKnowledgeBaseTempAttachment(input: $input) {
      userErrors {
        message
      }
    }
  }
`;

type UploadStatus = 'uploading' | 'uploaded' | 'error';

/** A file added on this page: on its way up, up, or failed. */
interface Upload {
  /** Stable for the row's lifetime — the temporary attachment's id arrives only once the upload is in. */
  key: string;
  tempId: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
  status: UploadStatus;
  error?: string;
}

/** One row of the attachments list, as `FileUpload` draws it. */
export interface AttachmentFile {
  id: string;
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  error?: string;
}

/**
 * The article form's attachments: the files the article already has, minus the
 * ones removed here, plus the ones uploaded here. Nothing touches the article
 * until it is saved — the save is handed `tempIds` to attach and `removedIds` to
 * delete.
 */
export function useArticleAttachments(stored: ReadonlyArray<StoredAttachment>) {
  const { toast } = useToast();
  const [commitCreateUpload] = useMutation<CreateUploadMutationType>(createUploadMutation);
  const [commitDiscardUpload] = useMutation<DiscardUploadMutationType>(discardUploadMutation);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const patchUpload = (key: string, patch: Partial<Upload>) =>
    setUploads(current => current.map(upload => (upload.key === key ? { ...upload, ...patch } : upload)));

  const upload = (source: UploadSource) => {
    const key = `upload-${crypto.randomUUID()}`;
    const meta = uploadSourceMeta(source);
    setUploads(current => [...current, { key, tempId: null, ...meta, status: 'uploading' }]);

    const fail = (message: string) => {
      patchUpload(key, { status: 'error', error: message });
      toast({ title: 'Upload Error', description: message, variant: 'destructive' });
    };

    commitCreateUpload({
      variables: { input: meta },
      onCompleted: ({ createKnowledgeBaseTempAttachmentUploadUrl: { tempAttachment, userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal || !tempAttachment) {
          fail(refusal?.message ?? 'No attachment data returned');
          return;
        }
        putUploadSource(source, tempAttachment.uploadUrl).then(
          () => patchUpload(key, { tempId: tempAttachment.id, status: 'uploaded' }),
          (error: unknown) => fail(error instanceof Error ? error.message : 'Upload failed'),
        );
      },
      onError: error => fail(getRelayErrorMessage(error, 'Upload failed')),
    });
  };

  const remove = (id: string) => {
    const added = uploads.find(candidate => candidate.key === id);
    if (!added) {
      // One of the article's own files: it goes when the article is saved.
      setRemovedIds(current => [...current, id]);
      return;
    }
    setUploads(current => current.filter(candidate => candidate.key !== id));
    if (!added.tempId) return;

    const warn = (message: string) => {
      toast({ title: 'Warning', description: message, variant: 'destructive' });
    };
    commitDiscardUpload({
      variables: { input: { id: added.tempId } },
      onCompleted: ({ deleteKnowledgeBaseTempAttachment: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) warn(refusal.message);
      },
      onError: error => warn(getRelayErrorMessage(error, 'Failed to remove file')),
    });
  };

  const files: AttachmentFile[] = [
    ...stored
      .filter(attachment => !removedIds.includes(attachment.id))
      .map(attachment => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        status: 'uploaded' as const,
      })),
    ...uploads.map(added => ({
      id: added.key,
      fileName: added.fileName,
      fileSize: added.fileSize,
      status: added.status,
      error: added.error,
    })),
  ];

  return {
    files,
    upload,
    remove,
    /** A save now would leave these files behind. */
    isUploading: uploads.some(added => added.status === 'uploading'),
    /** The uploaded files, for the save to attach. */
    tempIds: uploads.flatMap(added => (added.status === 'uploaded' && added.tempId ? [added.tempId] : [])),
    /** The article's own files removed here, for the save to delete. */
    removedIds,
  };
}

export type ArticleAttachments = ReturnType<typeof useArticleAttachments>;
