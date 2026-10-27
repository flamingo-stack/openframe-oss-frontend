'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useAssigneeOptions } from '../hooks/use-assignee-options';
import { renderAvatarOption } from './avatar-autocomplete';

interface AssigneeFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

const renderOption = renderAvatarOption('round');

export function AssigneeFilter({ value, onChange, className }: AssigneeFilterProps) {
  const {
    options: sortedOptions,
    isLoading,
    onSearchChange,
  } = useAssigneeOptions({ selectedIds: value, selfFirst: true });

  return (
    <Autocomplete
      multiple
      options={sortedOptions}
      value={value}
      onChange={onChange}
      placeholder="Show All Employees"
      onInputChange={onSearchChange}
      loading={isLoading}
      disableClientFilter
      startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
      renderOption={renderOption}
      className={className}
    />
  );
}
