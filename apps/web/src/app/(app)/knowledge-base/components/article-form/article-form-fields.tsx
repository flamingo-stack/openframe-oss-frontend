'use client';
'use no memo';

import { FieldWrapper, FileUpload, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { EntityTagPicker, EntityTagPickerFallback } from '@/app/components/shared/tags';
import { AssignmentsField } from '@/components/assignments';
import { TagEntityType } from '@/generated/schema-enums';
import { nativeFilePicker, type UploadSource } from '@/lib/native-files';
import { FolderPicker } from '../shared/folder-picker';
import { FolderPickerFallback } from '../shared/folder-picker-fallback';
import { MarkdownEditor, SimpleMarkdownRenderer } from '../shared/lazy-markdown';
import type { ArticleFormData } from './article-form.types';
import type { ArticleAttachments } from './use-article-attachments';
import { useArticleImageUpload } from './use-article-image-upload';

const TAGS_PLACEHOLDER = 'Select or create tags...';

/** The editor's preview pane draws the article the way its page will. At module scope: the editor keeps the function. */
const renderPreview = (source: string) => (
  <div className="custom-preview-wrapper h-full overflow-auto">
    <SimpleMarkdownRenderer content={source} />
  </div>
);

interface ArticleFormFieldsProps {
  form: UseFormReturn<ArticleFormData>;
  /** Locks every control — the edit page's loading state is this same tree, locked. */
  disabled: boolean;
  /** The article's own tags, so the picker draws their chips before its own list is in. */
  initialTags: ReadonlyArray<{ id: string; key: string }>;
  attachments: ArticleAttachments;
}

/** The article form's fields. The folder and tag pickers keep their own boundaries: each is a query of its own. */
export function ArticleFormFields({ form, disabled, initialTags, attachments }: ArticleFormFieldsProps) {
  const { control } = form;
  const uploadArticleImage = useArticleImageUpload();

  const handleFilesAdded = (incoming: UploadSource | UploadSource[] | undefined) => {
    if (!incoming) return;
    for (const file of Array.isArray(incoming) ? incoming : [incoming]) {
      attachments.upload(file);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] md:grid-cols-2">
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <div>
              <Input
                type="text"
                label="Article Title"
                value={field.value}
                onChange={field.onChange}
                placeholder="Enter article title"
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                disabled={disabled}
              />
            </div>
          )}
        />

        <Controller
          name="folderId"
          control={control}
          render={({ field }) => (
            <FieldWrapper label="Folder">
              <Suspense fallback={<FolderPickerFallback />}>
                <FolderPicker value={field.value} onSelect={target => field.onChange(target.id)} disabled={disabled} />
              </Suspense>
            </FieldWrapper>
          )}
        />
      </div>

      <Controller
        name="tags"
        control={control}
        render={({ field }) => (
          <Suspense fallback={<EntityTagPickerFallback emptyPlaceholder={TAGS_PLACEHOLDER} />}>
            <EntityTagPicker
              entityType={TagEntityType.KNOWLEDGE_ARTICLE}
              selectedIds={field.value}
              onChange={field.onChange}
              initialTags={initialTags}
              emptyPlaceholder={TAGS_PLACEHOLDER}
              maxCreateLength={25}
              deletable
              disabled={disabled}
              entityLabel="article"
            />
          </Suspense>
        )}
      />

      <Controller
        name="body"
        control={control}
        render={({ field }) => (
          <MarkdownEditor
            value={field.value}
            onChange={field.onChange}
            placeholder="Write the article content..."
            height={400}
            renderPreview={renderPreview}
            onUploadFile={uploadArticleImage}
            disabled={disabled}
          />
        )}
      />

      <FileUpload
        onChange={handleFilesAdded}
        pickFiles={nativeFilePicker({ multiple: true })}
        managedFiles={attachments.files}
        onRemoveManagedFile={attachments.remove}
        multiple
        label="Attachments"
        description="(Click Here or Drag and Drop)"
        disabled={disabled}
      />

      <Controller
        name="assignments"
        control={control}
        render={({ field }) => (
          <AssignmentsField value={field.value ?? {}} onChange={field.onChange} disabled={disabled} />
        )}
      />
    </>
  );
}
