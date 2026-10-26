'use client';

import { Autocomplete, type AutocompleteOption, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface NewOwnerFieldProps {
  options: AutocompleteOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  onSearch: (search: string) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
}

/**
 * The "New Owner" control. While the candidates are read (a loading scope) the field draws its own loading form;
 * `loading` is a search in flight under a field that stays up.
 */
export function NewOwnerField({ options, value, onChange, onSearch, loading, disabled, error }: NewOwnerFieldProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xs)]">
      <Label htmlFor="new-owner-select">New Owner</Label>
      <Autocomplete
        options={options}
        value={value}
        onChange={onChange}
        onInputChange={(search, reason) => {
          if (reason === 'input') onSearch(search);
        }}
        disableClientFilter
        placeholder="Select new owner"
        loading={loading}
        disabled={disabled}
        error={error}
        invalid={!!error}
        noOptionsText="No active users found"
      />
    </div>
  );
}
