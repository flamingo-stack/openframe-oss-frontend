'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getFullImageUrl } from '@/lib/image-url';

/**
 * Inline article images need a durable, directly GET-able URL because the editor
 * persists it inside the markdown content — the presigned-URL attachment flow
 * (use-article-temp-attachments) expires and cannot be embedded.
 *
 * Flow (BE task 86ajtc4hc): POST metadata → { url, uploadUrl, uploadHeaders },
 * PUT the file bytes to the presigned `uploadUrl`, then embed `url` — a stable
 * `/knowledge-base/images/<id>` path that redirects to a fresh signed URL on GET.
 */
const ARTICLE_IMAGE_UPLOAD_ENDPOINT = '/api/knowledge-base/images';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
// Mirrors the BE whitelist (openframe.kb.images.allowed-types) so unsupported
// formats fail fast with a clear message instead of a generic 4xx from the API.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_TYPES_LABEL = 'JPG, PNG, WebP';

interface CreateArticleImageResponse {
  url: string;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
}

async function uploadArticleImage(file: File): Promise<string> {
  const response = await apiClient.post<CreateArticleImageResponse>(ARTICLE_IMAGE_UPLOAD_ENDPOINT, {
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  if (!response.ok || !response.data?.uploadUrl || !response.data.url) {
    throw new Error(response.error || 'Failed to create image upload URL');
  }

  const { url, uploadUrl, uploadHeaders } = response.data;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, ...uploadHeaders },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }

  return getFullImageUrl(url) ?? url;
}

/**
 * Upload handler for MarkdownEditor's `onUploadFile` — enables clipboard paste
 * and the toolbar upload button. Returns the durable image URL the editor
 * inserts as `![name](url)`.
 */
export function useArticleImageUpload() {
  const { toast } = useToast();

  return useCallback(
    async (file: File): Promise<string> => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        const isImage = file.type.startsWith('image/');
        toast({
          title: isImage ? 'Unsupported image format' : 'Only images can be inserted',
          description: isImage
            ? `Supported formats: ${ALLOWED_IMAGE_TYPES_LABEL}.`
            : 'Use the Attachments field below for other file types.',
          variant: 'destructive',
        });
        throw new Error(`Only ${ALLOWED_IMAGE_TYPES_LABEL} images can be inserted into the article`);
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
        return await uploadArticleImage(file);
      } catch (err) {
        toast({
          title: 'Image upload failed',
          description: 'Failed to upload image. Please try again.',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast],
  );
}
