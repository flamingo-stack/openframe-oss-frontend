'use client';

import { Autocomplete } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OPTIMISTIC_TAG_ID_PREFIX, useCreateTagMutation } from '@/app/components/shared/tags';
import { useTicketTagDelete } from '../../hooks/use-ticket-tag-delete';
import { useTicketTags } from '../../hooks/use-ticket-tags';

interface TicketTagsManagerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TicketTagsManager({ selectedIds, onChange, disabled }: TicketTagsManagerProps) {
  const { data: tags = [], refetch } = useTicketTags();
  const { createTag, isInFlight: isCreating } = useCreateTagMutation();

  // Wraps the callback-based createTag API in a Promise so call sites below
  // read like a standard async mutation instead of threading success/error
  // callbacks through the logic. This is a local adapter only; the underlying
  // hook still exposes success/error callbacks rather than a Promise/mutation
  // result, which is what the finding ultimately wants fixed at the hook.
  const createTagAsync = useCallback(
    (key: string) =>
      new Promise<string | null>(resolve => {
        createTag(
          { key, entityType: 'TICKET' },
          realId => resolve(realId),
          () => resolve(null),
        );
      }),
    [createTag],
  );

  const [optimisticTags, setOptimisticTags] = useState<Array<{ key: string; tempId: string }>>([]);

  // Always-current selection for the async create callbacks: they reconcile
  // against whatever is selected when the create lands, not the snapshot taken
  // when it was fired — otherwise a tag picked meanwhile was dropped. Written
  // after the commit, since a render-phase ref write is what `react-hooks/refs`
  // forbids. Same shape as the shared EntityTagPicker.
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  const { requestDelete, isDeleting, dialog } = useTicketTagDelete(id => {
    onChange(selectedIds.filter(sid => sid !== id));
  });

  const options = useMemo(
    () => [
      ...tags.map(t => ({ label: t.key, value: t.id })),
      ...optimisticTags.map(t => ({ label: t.key, value: t.tempId })),
    ],
    [tags, optimisticTags],
  );

  const handleChange = useCallback(
    (values: string[]) => {
      const isKnown = (v: string) => tags.some(t => t.id === v) || optimisticTags.some(t => t.tempId === v);
      const existingIds = values.filter(isKnown);
      const newKeys = values.filter(v => !isKnown(v));

      if (newKeys.length === 0) {
        onChange(existingIds);
        return;
      }

      // One `onChange` carrying every new key, so two tags created in a single
      // change don't clobber each other's placeholder.
      const pending = newKeys.map(key => ({ key, tempId: `${OPTIMISTIC_TAG_ID_PREFIX}${crypto.randomUUID()}` }));
      setOptimisticTags(prev => [...prev, ...pending]);
      onChange([...existingIds, ...pending.map(p => p.tempId)]);

      const settle = (tempId: string, realId: string | null) => {
        setOptimisticTags(prev => prev.filter(t => t.tempId !== tempId));
        const current = selectedIdsRef.current;
        onChange(realId ? current.map(id => (id === tempId ? realId : id)) : current.filter(id => id !== tempId));
      };

      for (const { key, tempId } of pending) {
        void createTagAsync(key).then(realId => {
          if (realId) {
            // Refetch first, so the persisted tag has an option (a labelled chip)
            // by the time it replaces the placeholder.
            void refetch().then(() => settle(tempId, realId));
          } else {
            // A failed create must not leave the form carrying an id that was
            // never persisted.
            settle(tempId, null);
          }
        });
      }
    },
    [tags, optimisticTags, onChange, createTagAsync, refetch],
  );

  return (
    <>
      <Autocomplete
        multiple
        options={options}
        value={selectedIds}
        onChange={handleChange}
        placeholder={selectedIds.length > 0 ? 'Add more...' : 'Select or create tags...'}
        label="Tags"
        loading={isCreating}
        disabled={disabled}
        showChevron={false}
        creatable
        maxCreateLength={25}
        onDeleteOption={requestDelete}
        isDeletingOption={isDeleting}
        freeSolo
      />
      {dialog}
    </>
  );
}
