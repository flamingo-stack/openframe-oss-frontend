'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { entityTagPickerQuery as EntityTagPickerQueryType } from '@/__generated__/entityTagPickerQuery.graphql';
import type { TagEntityType } from '@/generated/schema-enums';
import { OPTIMISTIC_TAG_ID_PREFIX } from './optimistic-tag-id';
import { TagDeleteConfirmDialog } from './tag-delete-confirm-dialog';
import { useCreateTagMutation, useDeleteTagMutation } from './use-tag-mutations';

/**
 * Full tag vocabulary for a given entity type (tenant-wide) — every tag a user can
 * assign, including freshly created / unlinked ones. `$entityType` is a variable so
 * one static query serves every entity type; distinct values get distinct store keys.
 */
export const entityTagPickerQuery = graphql`
  query entityTagPickerQuery($entityType: TagEntityType!) {
    tagsByEntityType(entityType: $entityType) {
      id
      key
    }
  }
`;

interface EntityTag {
  id: string;
  key: string;
}

const fallbackNoop = () => {};

// Shared defaults — the fallback must render the EXACT same label/placeholder as
// the picker (its whole purpose is a zero-layout-shift swap), so both default
// from these constants instead of keeping parallel literals in sync by hand.
const DEFAULT_LABEL = 'Search and add Tags';
const DEFAULT_EMPTY_PLACEHOLDER = 'Search to Add Tags';
const ADD_MORE_PLACEHOLDER = 'Add more...';

/** The placeholder the picker shows: one rule for the loaded picker and its skeleton. */
const pickerPlaceholder = (selectedCount: number, emptyPlaceholder: string) =>
  selectedCount > 0 ? ADD_MORE_PLACEHOLDER : emptyPlaceholder;

/**
 * {@link EntityTagPicker} while its vocabulary is read: the real `Autocomplete`,
 * disabled, with the same label / placeholder / search adornment and the chips of
 * the tags already selected (an edit form shows them from the entity it read), so
 * the swap to the loaded picker causes zero layout shift.
 */
function EntityTagPickerSkeleton({
  selectedIds,
  initialTags = [],
  label = DEFAULT_LABEL,
  emptyPlaceholder = DEFAULT_EMPTY_PLACEHOLDER,
}: Pick<EntityTagPickerProps, 'selectedIds' | 'initialTags' | 'label' | 'emptyPlaceholder'>) {
  const options = initialTags.map(tag => ({ label: tag.key, value: tag.id }));
  const value = selectedIds.filter(id => initialTags.some(tag => tag.id === id));
  return (
    <LoadingRegion className="contents" label="Loading tags">
      <Autocomplete
        multiple
        disabled
        label={label}
        placeholder={pickerPlaceholder(selectedIds.length, emptyPlaceholder)}
        options={options}
        value={value}
        onChange={fallbackNoop}
        startAdornment={<SearchIcon className="size-6 text-ods-text-secondary" />}
        showChevron={false}
      />
    </LoadingRegion>
  );
}

interface EntityTagPickerProps {
  /** Tag entity type — drives the vocabulary query and the create mutation. */
  entityType: TagEntityType;
  /** Selected Tag ids (the form's tag-ids field). */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Tags already assigned to the entity. Seeded into the options so their chips
   * render with a key even when they fall outside the fetched vocabulary.
   */
  initialTags?: ReadonlyArray<EntityTag>;
  disabled?: boolean;
  label?: string;
  /** Placeholder shown when nothing is selected yet. */
  emptyPlaceholder?: string;
  /** Max length for a freshly-typed tag name (`undefined` → no explicit cap). */
  maxCreateLength?: number;
  /**
   * When true, options expose a delete affordance that removes the tag from the
   * tenant vocabulary (global delete). `entityLabel` names the entity in the
   * confirm dialog (e.g. "article").
   */
  deletable?: boolean;
  entityLabel?: string;
}

/**
 * Searchable, creatable multi-select over the full tag vocabulary for an entity
 * type. Values are Tag ids, mapping straight to a `tagIds` write input. Typing a
 * new name and confirming creates the tag immediately and swaps the optimistic
 * entry for the persisted id. Shared by the script and article editors.
 *
 * Suspends on the vocabulary query — render inside a `<Suspense>` boundary whose
 * fallback is the same picker in a loading scope (`LoadingFallback`), where it draws
 * its own skeleton and runs no query.
 */
export function EntityTagPicker(props: EntityTagPickerProps) {
  if (useLoadingScope()) {
    return (
      <EntityTagPickerSkeleton
        selectedIds={props.selectedIds}
        initialTags={props.initialTags}
        label={props.label}
        emptyPlaceholder={props.emptyPlaceholder}
      />
    );
  }
  return <LiveEntityTagPicker {...props} />;
}

function LiveEntityTagPicker({
  entityType,
  selectedIds,
  onChange,
  initialTags = [],
  disabled,
  label = DEFAULT_LABEL,
  emptyPlaceholder = DEFAULT_EMPTY_PLACEHOLDER,
  maxCreateLength,
  deletable = false,
  entityLabel,
}: EntityTagPickerProps) {
  // `store-and-network`: revalidate the tag vocabulary on each mount so newly added
  // tenant tags show up (admin app — freshness over cache). Locally created tags are
  // still tracked in `createdTags`, so the refresh never drops in-flight additions.
  const data = useLazyLoadQuery<EntityTagPickerQueryType>(
    entityTagPickerQuery,
    { entityType },
    { fetchPolicy: 'store-and-network' },
  );

  const { createTag, isInFlight: isCreating } = useCreateTagMutation();
  const { deleteTag, isInFlight: isDeleting } = useDeleteTagMutation();

  // Tags created during this session (kept so their option/chip persists without
  // refetching the vocabulary) and the in-flight optimistic placeholders.
  const [createdTags, setCreatedTags] = useState<EntityTag[]>([]);
  const [optimisticTags, setOptimisticTags] = useState<Array<{ key: string; tempId: string }>>([]);
  const [tagToDelete, setTagToDelete] = useState<{ id: string; key: string } | null>(null);

  // Always-current selection, so async create callbacks reconcile against the
  // latest value (not a stale snapshot) — otherwise concurrent tag creations
  // would overwrite each other. Assigning during render is safe for a ref.
  const selectedIdsRef = useRef(selectedIds);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  const options = useMemo(() => {
    // Dedupe by id, merging vocabulary with assigned / created / in-flight tags.
    const byId = new Map<string, string>();
    for (const tag of initialTags) byId.set(tag.id, tag.key);
    for (const tag of data.tagsByEntityType) byId.set(tag.id, tag.key);
    for (const tag of createdTags) byId.set(tag.id, tag.key);
    const result = Array.from(byId, ([value, labelText]) => ({ label: labelText, value }));
    for (const tag of optimisticTags) result.push({ label: tag.key, value: tag.tempId });
    return result;
  }, [data.tagsByEntityType, initialTags, createdTags, optimisticTags]);

  const isKnownValue = useCallback(
    (value: string) =>
      data.tagsByEntityType.some(t => t.id === value) ||
      initialTags.some(t => t.id === value) ||
      createdTags.some(t => t.id === value) ||
      optimisticTags.some(t => t.tempId === value),
    [data.tagsByEntityType, initialTags, createdTags, optimisticTags],
  );

  const handleChange = useCallback(
    (values: string[]) => {
      const existingIds = values.filter(isKnownValue);
      const newKeys = values.filter(v => !isKnownValue(v));

      if (newKeys.length === 0) {
        onChange(existingIds);
        return;
      }

      // Give every new key its own optimistic temp id and add them ALL in one
      // `onChange`, so multiple tags created in a single change don't clobber each
      // other. Each create then swaps its own temp id for the real id against the
      // latest selection (via the ref), leaving concurrent additions intact.
      const pending = newKeys.map(key => ({ key, tempId: `${OPTIMISTIC_TAG_ID_PREFIX}${crypto.randomUUID()}` }));
      setOptimisticTags(prev => [...prev, ...pending]);
      onChange([...existingIds, ...pending.map(p => p.tempId)]);

      for (const { key, tempId } of pending) {
        createTag(
          { key, entityType },
          realId => {
            setOptimisticTags(prev => prev.filter(t => t.tempId !== tempId));
            if (realId) {
              setCreatedTags(prev => [...prev, { id: realId, key }]);
              onChange(selectedIdsRef.current.map(id => (id === tempId ? realId : id)));
            } else {
              // No persisted id came back — drop the orphaned temp id.
              onChange(selectedIdsRef.current.filter(id => id !== tempId));
            }
          },
          // On failure drop the optimistic chip and remove just this temp id so the
          // form never carries a tag id that was never persisted.
          () => {
            setOptimisticTags(prev => prev.filter(t => t.tempId !== tempId));
            onChange(selectedIdsRef.current.filter(id => id !== tempId));
          },
        );
      }
    },
    [isKnownValue, onChange, createTag, entityType],
  );

  const requestDelete = useCallback(
    (value: string) => {
      const key = options.find(o => o.value === value)?.label;
      if (key) setTagToDelete({ id: value, key });
    },
    [options],
  );

  // Deletes the tag entity globally; drop it from this selection too if attached.
  const confirmDelete = () => {
    if (!tagToDelete) return;
    deleteTag(tagToDelete.id, () => {
      onChange(selectedIds.filter(id => id !== tagToDelete.id));
      setCreatedTags(prev => prev.filter(t => t.id !== tagToDelete.id));
      setTagToDelete(null);
    });
  };

  return (
    <>
      <Autocomplete
        multiple
        creatable
        freeSolo
        label={label}
        placeholder={pickerPlaceholder(selectedIds.length, emptyPlaceholder)}
        options={options}
        value={selectedIds}
        onChange={handleChange}
        startAdornment={<SearchIcon className="size-6 text-ods-text-secondary" />}
        loading={isCreating}
        disabled={disabled}
        showChevron={false}
        maxCreateLength={maxCreateLength}
        onDeleteOption={deletable ? requestDelete : undefined}
        isDeletingOption={deletable ? isDeleting : undefined}
      />
      {deletable && (
        <TagDeleteConfirmDialog
          entityLabel={entityLabel ?? 'item'}
          tagName={tagToDelete?.key}
          open={tagToDelete !== null}
          isPending={isDeleting}
          onClose={() => setTagToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
