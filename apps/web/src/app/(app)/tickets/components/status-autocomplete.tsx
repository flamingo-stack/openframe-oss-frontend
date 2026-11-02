'use client';

import { CheckIcon, Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Autocomplete,
  type AutocompleteOption,
  ColorSwatch,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';

export interface StatusOption extends AutocompleteOption {
  color: string;
}

export function renderStatusOption(option: AutocompleteOption, isSelected: boolean): ReactNode {
  const { label, color } = option as StatusOption;
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
        <ColorSwatch color={color} />
        <div className="min-w-0">
          <TruncateText className="text-inherit">{label}</TruncateText>
        </div>
      </div>
      {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
    </div>
  );
}

export function statusStartAdornment(option: StatusOption | undefined): ReactNode | undefined {
  if (!option) return undefined;
  return <ColorSwatch color={option.color} />;
}

interface StatusFilterProps {
  /** The tenant's statuses (value = status id). */
  options: StatusOption[];
  value: string[];
  onChange: (statusIds: string[]) => void;
  className?: string;
}

/**
 * Tickets narrowed to some statuses (`?status=`, status ids): the filter modal's Status
 * section, and the board's control while a status filter is applied.
 */
export function StatusFilter({ options, value, onChange, className }: StatusFilterProps) {
  return (
    <Autocomplete
      multiple
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Show All Statuses"
      startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
      renderOption={renderStatusOption}
      className={className}
    />
  );
}
