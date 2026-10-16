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

/** The "New Owner" control — the same while the candidates load (locked) and once they are there. */
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
        placeholder={loading ? 'Loading users...' : 'Select new owner'}
        loading={loading}
        disabled={disabled}
        error={error}
        invalid={!!error}
        noOptionsText="No active users found"
      />
    </div>
  );
}
