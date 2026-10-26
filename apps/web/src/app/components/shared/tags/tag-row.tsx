'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete, Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo } from 'react';
import type { tagsEditor_keySuggestions$key as KeySuggestionsFragmentKey } from '@/__generated__/tagsEditor_keySuggestions.graphql';
import { noop } from '../no-next-page';
import { TagValueAutocomplete } from './tag-value-autocomplete';
import type { TagEntry } from './types';
import { useTagKeySuggestions } from './use-tag-key-suggestions';

/** Tag keys/values: alphanumeric, underscores, hyphens. Must start with a letter or digit. */
export const TAG_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
export const TAG_MAX_LENGTH = 64;
const TAG_FORMAT_MSG = 'Allowed characters: a-z, A-Z, 0-9, _, -';
const TAG_LENGTH_MSG = `Max length: ${TAG_MAX_LENGTH} characters`;

export function isValidTag(value: string): boolean {
  return value.length <= TAG_MAX_LENGTH && TAG_REGEX.test(value);
}

export function validateTagKey(key: string): string | undefined {
  if (!key) return undefined;
  if (key.length > TAG_MAX_LENGTH) return TAG_LENGTH_MSG;
  if (!TAG_REGEX.test(key)) return TAG_FORMAT_MSG;
  return undefined;
}

export function validateTagValues(values: string[]): string | undefined {
  if (values.some(v => v.length > TAG_MAX_LENGTH)) return TAG_LENGTH_MSG;
  if (values.some(v => !TAG_REGEX.test(v))) return TAG_FORMAT_MSG;
  return undefined;
}

interface TagRowProps {
  tag: TagEntry & { id: string };
  onChange: (tag: TagEntry) => void;
  onDelete: () => void;
  existingKeys: string[];
  keySuggestionsRef: KeySuggestionsFragmentKey;
  isFirst?: boolean;
}

interface DisabledTagValuesProps {
  values: string[];
  label: string | undefined;
  className: string | undefined;
}

/** The values field with nothing to suggest yet: no key chosen, or the key's values not read. */
function DisabledTagValues({ values, label, className }: DisabledTagValuesProps) {
  return (
    <Autocomplete
      multiple
      options={[]}
      value={values}
      onChange={noop}
      placeholder="Enter value..."
      label={label}
      labelVariant="large"
      className={className}
      showChevron={false}
      disabled
    />
  );
}

interface TagValuesProps extends DisabledTagValuesProps {
  tagKey: string;
  onChange: (values: string[]) => void;
  error: string | undefined;
  focusRef: (el: HTMLDivElement | null) => void;
}

/** The key's values, with their own boundary: in its scope the reader draws the field disabled. */
function TagValues(props: TagValuesProps) {
  return (
    <LoadingSuspense label="Loading tag values" className="contents">
      <TagValuesReader {...props} />
    </LoadingSuspense>
  );
}

function TagValuesReader({ tagKey, values, onChange, error, label, className, focusRef }: TagValuesProps) {
  if (useLoadingScope()) return <DisabledTagValues values={values} label={label} className={className} />;
  return (
    <div ref={focusRef}>
      <TagValueAutocomplete
        tagKey={tagKey}
        values={values}
        onChange={onChange}
        error={error}
        label={label}
        labelVariant="large"
        className={className}
      />
    </div>
  );
}

export function TagRow({ tag, onChange, onDelete, existingKeys, keySuggestionsRef, isFirst }: TagRowProps) {
  const {
    options: keyOptions,
    isRefetching: isKeyRefetching,
    handleInputChange: handleKeyInputChange,
    resetInput: resetKeyInput,
  } = useTagKeySuggestions(tag.key, keySuggestionsRef);

  const focusInputOnMount = useCallback((el: HTMLDivElement | null) => {
    el?.querySelector('input')?.focus();
  }, []);

  const handleKeyChange = useCallback(
    (value: string | null) => {
      resetKeyInput();
      const nextKey = value ?? '';
      const valuesChanged = nextKey !== tag.key;
      onChange({ key: nextKey, values: valuesChanged ? [] : tag.values });
    },
    [onChange, tag.key, tag.values, resetKeyInput],
  );

  const handleValuesChange = useCallback(
    (values: string[]) => {
      onChange({ key: tag.key, values });
    },
    [onChange, tag.key],
  );

  const labelClassName = isFirst ? '[&>label]:hidden content-md:[&>label]:block' : undefined;

  const isDuplicateKey = tag.key !== '' && existingKeys.filter(k => k === tag.key).length > 1;
  const keyError = useMemo(() => {
    if (isDuplicateKey) return 'Duplicate tag — this key is already used';
    return validateTagKey(tag.key);
  }, [tag.key, isDuplicateKey]);
  const valuesError = useMemo(() => validateTagValues(tag.values), [tag.values]);

  return (
    <div className="flex w-full flex-col items-start gap-[var(--spacing-system-l)] content-md:flex-row content-md:gap-[var(--spacing-system-s)]">
      <div className="w-full min-w-0 content-md:flex-1" ref={focusInputOnMount}>
        <Autocomplete
          options={keyOptions}
          value={tag.key || null}
          onChange={handleKeyChange}
          onInputChange={handleKeyInputChange}
          placeholder="Enter tag key..."
          label={isFirst ? 'Tag Name' : undefined}
          labelVariant="large"
          className={labelClassName}
          loading={isKeyRefetching}
          error={keyError}
          showChevron={false}
          clearOnOpen={false}
          disableClientFilter
          creatable
          freeSolo
        />
      </div>

      <div className="flex w-full min-w-0 items-end gap-[var(--spacing-system-s)] content-md:flex-1">
        <div className="min-w-0 flex-1">
          {tag.key ? (
            <TagValues
              tagKey={tag.key}
              values={tag.values}
              onChange={handleValuesChange}
              error={valuesError}
              label={isFirst ? 'Tag Values' : undefined}
              className={labelClassName}
              focusRef={focusInputOnMount}
            />
          ) : (
            <DisabledTagValues
              values={tag.values}
              label={isFirst ? 'Tag Values' : undefined}
              className={labelClassName}
            />
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onDelete}
          aria-label="Remove tag row"
          leftIcon={<TrashIcon className="size-4 text-ods-error content-md:size-6" />}
        />
      </div>
    </div>
  );
}
