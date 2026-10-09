'use client';

import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useMemo, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useAssignedItems } from '@/components/assignments';
import { KnowledgeBaseArticleStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { ArticleFormFields } from './article-form-fields';
import type { ArticleFormRecord, StoredArticle } from './article-form-record';
import { ArticleRecordLoader } from './article-record-loader';
import { useArticleForm } from './use-article-form';

const NO_TAGS: ArticleFormRecord['tags'] = [];

interface ArticleFormViewProps {
  /** The article edited; null creates one. */
  articleId: string | null;
  /** The folder a new article starts in. */
  initialFolderId?: string | null;
}

/**
 * `/knowledge-base/new` and `/knowledge-base/edit`: the article form. The title,
 * Back, the two Save buttons and the fields are on screen from the first paint;
 * on the edit page they are locked until the article — and what it is assigned
 * to — has seeded them. Compiled: it only passes `form` down and never reads
 * form state in render.
 */
export function ArticleFormView({ articleId, initialFolderId = null }: ArticleFormViewProps) {
  const isEdit = articleId !== null;
  const handleBack = useSafeBack(isEdit ? routes.knowledgeBase.details(articleId) : routes.knowledgeBase.list);

  // The article arrives in two halves: the record over Relay (the loader below
  // reports it in), its assignments over their own request.
  const [record, setRecord] = useState<ArticleFormRecord | null>(null);
  const assigned = useAssignedItems({ itemId: articleId, itemType: 'KNOWLEDGE_ARTICLE', enabled: isEdit });

  // Both halves or nothing: seeding the form with the record alone would read as
  // "no assignments", and the next Save would remove every one of them.
  // Memoized for its identity — `useSeedForm` seeds once per values object.
  const stored = useMemo<StoredArticle | null>(
    () =>
      record && assigned.isReady
        ? {
            values: { ...record.values, assignments: assigned.value },
            status: record.status,
            attachments: record.attachments,
          }
        : null,
    [record, assigned.isReady, assigned.value],
  );
  const isLoaded = !isEdit || stored !== null;

  const { form, attachments, isSubmitting, handleSave } = useArticleForm({ articleId, initialFolderId, stored });

  // A file still on its way up would be left out of the save.
  const isLocked = !isLoaded || isSubmitting || attachments.isUploading;
  const actions: PageActionButton[] = [
    {
      label: 'Save as Draft',
      onClick: () => handleSave(KnowledgeBaseArticleStatus.DRAFT),
      variant: 'outline',
      disabled: isLocked,
    },
    {
      label: 'Save and Publish',
      onClick: () => handleSave(KnowledgeBaseArticleStatus.PUBLISHED),
      variant: 'accent',
      disabled: isLocked,
    },
  ];

  return (
    <PageLayout
      title={isEdit ? 'Edit Article' : 'New Article'}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
    >
      {isEdit && (
        <Suspense fallback={null}>
          <ArticleRecordLoader articleId={articleId} onResolved={setRecord} />
        </Suspense>
      )}
      {/* Locked fields announce nothing on their own; the text switches, the live region stays mounted. */}
      <span role="status" className="sr-only">
        {isLoaded ? '' : 'Loading article…'}
      </span>
      <ArticleFormFields
        form={form}
        disabled={!isLoaded || isSubmitting}
        initialTags={record?.tags ?? NO_TAGS}
        attachments={attachments}
      />
    </PageLayout>
  );
}
