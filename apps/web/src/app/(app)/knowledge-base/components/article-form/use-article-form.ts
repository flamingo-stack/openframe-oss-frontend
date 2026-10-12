'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { routes } from '@/lib/routes';
import type { StoredArticle, StoredAttachment } from './article-form-record';
import { ARTICLE_FORM_DEFAULTS, type ArticleFormData, articleFormSchema } from './article-form.types';
import { useArticleAttachments } from './use-article-attachments';
import { type SaveStatus, useSaveArticle } from './use-save-article';

const NO_ATTACHMENTS: ReadonlyArray<StoredAttachment> = [];

interface UseArticleFormOptions {
  /** The article edited; null creates one. */
  articleId: string | null;
  /** The folder a new article starts in — the one its "Add Article" was pressed in. */
  initialFolderId: string | null;
  /** The article as it was loaded; null while it loads, and always when creating. */
  stored: StoredArticle | null;
}

/**
 * The article form — the create page's and the edit page's. It is real from the
 * first paint: an edited article seeds it when it arrives (`useSeedForm`, called
 * here because this is the owner of `useForm`).
 */
export function useArticleForm({ articleId, initialFolderId, stored }: UseArticleFormOptions) {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: { ...ARTICLE_FORM_DEFAULTS, folderId: initialFolderId },
  });
  useSeedForm(form, stored?.values ?? null);

  const attachments = useArticleAttachments(stored?.attachments ?? NO_ATTACHMENTS);
  const { save, isSaving } = useSaveArticle();

  // Set on the click: `handleSubmit` awaits the resolver, so a second click can land
  // before `isSaving` disables the buttons. Cleared once the write starts.
  const inFlightRef = useRef(false);

  const onValid = (values: ArticleFormData, status: SaveStatus) => {
    inFlightRef.current = false;
    save(
      {
        articleId,
        values,
        status,
        attachmentTempIds: attachments.tempIds,
        deleteAttachmentIds: attachments.removedIds,
        stored,
      },
      savedId => {
        if (articleId === null) {
          toast({ title: 'Success', description: 'Article created', variant: 'success' });
          router.replace(routes.knowledgeBase.details(savedId));
        } else {
          toast({ title: 'Success', description: 'Article updated', variant: 'success' });
          safeBackOrReplace(router, routes.knowledgeBase.details(savedId));
        }
      },
    );
  };

  const handleSave = (status: SaveStatus) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    void form.handleSubmit(
      values => onValid(values, status),
      errors => {
        inFlightRef.current = false;
        const messages = Object.values(errors)
          .map(error => error?.message)
          .filter((message): message is string => Boolean(message));
        toast({
          title: 'Validation Error',
          description: messages.length > 0 ? messages.join(', ') : 'Please fix the highlighted fields.',
          variant: 'destructive',
        });
      },
    )();
  };

  return { form, attachments, isSubmitting: isSaving, handleSave };
}
