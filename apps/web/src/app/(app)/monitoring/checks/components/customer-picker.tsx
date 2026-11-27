'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { useOrganizationOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { type EntityPickerProps, PickerField } from './picker-field';

/** The customer a CUSTOMER exception is for, searched on the server. */
export function CustomerPicker(props: EntityPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { options, isLoading } = useOrganizationOptions(debouncedSearch);
  return <PickerField {...props} options={options} onSearch={setSearch} loading={isLoading} />;
}
