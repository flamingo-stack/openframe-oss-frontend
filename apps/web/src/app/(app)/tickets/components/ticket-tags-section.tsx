'use client';

import { Tag, TagSelectDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { useCreateTagMutation } from '@/app/components/shared/tags';
import { useSetTicketTags } from '../hooks/use-ticket-detail-mutations';
import { useTicketTagDelete } from '../hooks/use-ticket-tag-delete';
import { useTicketTags } from '../hooks/use-ticket-tags';
import type { Dialog } from '../types/dialog.types';

interface TicketTagsSectionProps {
  ticketId: string;
  tags: NonNullable<Dialog['tags']>;
}

export function TicketTagsSection({ ticketId, tags }: TicketTagsSectionProps) {
  const { data: allTags = [], refetch } = useTicketTags();
  const { createTag, isInFlight: isCreating } = useCreateTagMutation();
  const setTags = useSetTicketTags(ticketId);

  const options = useMemo(() => allTags.map(t => ({ id: t.id, label: t.key })), [allTags]);
  const selectedIds = useMemo(() => tags.map(t => t.id), [tags]);

  const { requestDelete, isDeleting, dialog } = useTicketTagDelete(id => {
    if (selectedIds.includes(id)) setTags.mutate(selectedIds.filter(cid => cid !== id));
  });

  const handleChange = (ids: string[]) => setTags.mutate(ids);
  const removeTag = (id: string) => setTags.mutate(selectedIds.filter(cid => cid !== id));
  const handleCreate = (name: string) => {
    createTag({ key: name, entityType: 'TICKET' }, realId => {
      refetch().then(() => {
        if (realId) setTags.mutate([...selectedIds, realId]);
      });
    });
  };

  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <p className="text-ods-text-secondary text-h5">Tags</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
          {tags.map(t => (
            <Tag
              key={t.id}
              label={t.key}
              variant="outline"
              onClose={() => removeTag(t.id)}
              disabled={setTags.isPending}
              className="min-w-0 max-w-full"
              labelClassName="min-w-0"
            />
          ))}
        </div>
      )}
      <TagSelectDropdown
        options={options}
        selectedIds={selectedIds}
        onChange={handleChange}
        onCreate={handleCreate}
        maxCreateLength={25}
        onDelete={requestDelete}
        isCreating={isCreating}
        isDeleting={isDeleting}
        searchPlaceholder="Search or create tags..."
      />
      {dialog}
    </section>
  );
}
