'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { uploadWithAuth } from '@/lib/upload-with-auth';

/**
 * Inline article images need a durable, directly GET-able URL because the editor
 * persists it inside the markdown content — the presigned-URL attachment flow
 * (use-article-temp-attachments) expires and cannot be embedded.
 */
const ARTICLE_IMAGE_UPLOAD_ENDPOINT = '/api/knowledge-base/images';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Upload handler for MarkdownEditor's `onUploadFile` — enables clipboard paste
 * and the toolbar upload button. Returns the durable image URL the editor
 * inserts as `![name](url)`.
 */
export function useArticleImageUpload() {
  const { toast } = useToast();

  return useCallback(
    async (file: File): Promise<string> => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Only images can be inserted',
          description: 'Use the Attachments field below for other file types.',
          variant: 'destructive',
        });
        throw new Error('Only image files can be inserted into the article');
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({
          title: 'Image is too large',
          description: 'Maximum image size is 10 MB.',
          variant: 'destructive',
        });
        throw new Error('Image exceeds the 10 MB size limit');
      }

      try {
        const url = await uploadWithAuth(ARTICLE_IMAGE_UPLOAD_ENDPOINT, file);
        return getFullImageUrl(url) ?? url;
      } catch (err) {
        toast({
          title: 'Image upload failed',
          description: err instanceof Error ? err.message : 'Failed to upload image',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast],
  );
}
