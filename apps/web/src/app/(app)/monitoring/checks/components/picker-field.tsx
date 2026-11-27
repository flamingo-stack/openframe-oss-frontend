'use client';

import { Autocomplete, type AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import type { OverrideScopeType } from '../utils/check-transform';

const ENTITY_PLACEHOLDERS: Record<OverrideScopeType, string> = {
  CUSTOMER: 'Select customer',
  TAG: 'Select tag',
  DEVICE: 'Select device',
};

/** What every entity picker of the exception form takes. */
export interface EntityPickerProps {
  type: OverrideScopeType;
  value: string | null;
  selectedLabel: string | null;
  /** The picked entity's id and name (the option's label). */
  onChange: (id: string | null, name: string | null) => void;
  /** The pick cannot be saved (it already has an exception): the field draws its error border; the host says why. */
  invalid?: boolean;
}

interface PickerFieldProps extends EntityPickerProps {
  options: readonly AutocompleteOption[];
  /** Given when the field searches on the server: it shows the server's matches as they are. */
  onSearch?: (search: string) => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
}

/** The single-pick field every entity kind draws, its picked entity always among the options. */
export function PickerField({
  type,
  value,
  selectedLabel,
  onChange,
  invalid = false,
  options,
  onSearch,
  loading,
  error,
  disabled,
}: PickerFieldProps) {
  const withSelected = useMemo(() => {
    if (!value || options.some(option => option.value === value)) return [...options];
    return [{ value, label: selectedLabel ?? value }, ...options];
  }, [options, value, selectedLabel]);
  return (
    <Autocomplete
      options={withSelected}
      value={value}
      onChange={id => onChange(id, withSelected.find(option => option.value === id)?.label ?? null)}
      onInputChange={onSearch}
      disableClientFilter={Boolean(onSearch)}
      placeholder={ENTITY_PLACEHOLDERS[type]}
      loading={loading}
      error={error}
      invalid={invalid}
      disabled={disabled}
    />
  );
}
