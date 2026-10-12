'use client';

import type { AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useDeferredValue, useState } from 'react';
import { NewOwnerCandidates } from './new-owner-candidates';
import { NewOwnerField } from './new-owner-field';

const NO_OPTIONS: AutocompleteOption[] = [];

interface NewOwnerSelectProps {
  currentUserId: string;
  organizationName: string;
  /** The raw id of the picked user. */
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

/**
 * "New Owner" picker for the owner variant of the delete-account modal. It
 * mounts with the modal, so the users request fires only while the owner has
 * it open.
 */
export function NewOwnerSelect({ currentUserId, organizationName, value, onChange, disabled }: NewOwnerSelectProps) {
  const [input, setInput] = useState('');
  const debouncedInput = useDebounce(input, 300);
  const search = useDeferredValue(debouncedInput);
  const [picked, setPicked] = useState<AutocompleteOption | null>(null);

  return (
    <Suspense
      fallback={
        <NewOwnerField options={NO_OPTIONS} value={null} onChange={() => {}} onSearch={setInput} loading disabled />
      }
    >
      <NewOwnerCandidates
        currentUserId={currentUserId}
        organizationName={organizationName}
        search={search}
        isSearching={search !== debouncedInput}
        onSearch={setInput}
        value={value}
        picked={picked}
        onChange={option => {
          setPicked(option);
          onChange(option?.value ?? '');
        }}
        disabled={disabled}
      />
    </Suspense>
  );
}
