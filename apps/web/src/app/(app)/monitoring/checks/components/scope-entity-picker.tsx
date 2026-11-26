'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  DEFAULT_DEVICES_LIST_STATUSES,
  getDeviceName,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  Autocomplete,
  type AutocompleteOption,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { scopeEntityPickerTagsQuery as ScopeEntityPickerTagsQueryType } from '@/__generated__/scopeEntityPickerTagsQuery.graphql';
import { fetchDevicesPage } from '@/app/(app)/devices/queries/devices-api';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';
import { useOrganizationOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { ContentErrorBoundary, NO_ITEMS } from '@/app/components/shared';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import type { OverrideScopeType } from '../utils/check-transform';

/** The device tags a TAG override is picked from. The API resolves a tag scope by `Tag.id` and refuses any other tag. */
const scopeEntityPickerTagsQuery = graphql`
  query scopeEntityPickerTagsQuery {
    tagsByEntityType(entityType: DEVICE) {
      id
      key
    }
  }
`;

const DEVICE_OPTIONS_LIMIT = 50;

const ENTITY_PLACEHOLDERS: Record<OverrideScopeType, string> = {
  CUSTOMER: 'Select customer',
  TAG: 'Select tag',
  DEVICE: 'Select device',
};

interface ScopeEntityPickerProps {
  type: OverrideScopeType;
  value: string | null;
  selectedLabel: string | null;
  /** The picked entity's id and name (the option's label). */
  onChange: (id: string | null, name: string | null) => void;
  /** The pick cannot be saved (it already has an exception): the field draws its error border; the host says why. */
  invalid?: boolean;
}

/** The customer, device tag or device an override is for: a single pick, searched on the server where the list is long. */
export function ScopeEntityPicker(props: ScopeEntityPickerProps) {
  switch (props.type) {
    case InsightCheckScopeType.CUSTOMER:
      return <CustomerPicker {...props} />;
    case InsightCheckScopeType.DEVICE:
      return <DevicePicker {...props} />;
    case InsightCheckScopeType.TAG:
      return (
        <ContentErrorBoundary
          fallback={() => <PickerField {...props} options={NO_ITEMS} error="Couldn't load tags" disabled />}
        >
          <TagPickerIsland {...props} />
        </ContentErrorBoundary>
      );
  }
}

/** The tag field with its own boundary. */
function TagPickerIsland(props: ScopeEntityPickerProps) {
  return (
    <LoadingSuspense label="Loading tags">
      <TagPicker {...props} />
    </LoadingSuspense>
  );
}

/** The single-pick field every entity kind draws, its picked entity always among the options. */
function PickerField({
  type,
  value,
  selectedLabel,
  onChange,
  options,
  onSearch,
  loading,
  error,
  disabled,
  invalid = false,
}: ScopeEntityPickerProps & {
  options: readonly AutocompleteOption[];
  onSearch?: (search: string) => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
}) {
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
      // A field that searches on the server shows the server's matches as they are.
      disableClientFilter={Boolean(onSearch)}
      placeholder={ENTITY_PLACEHOLDERS[type]}
      loading={loading}
      error={error}
      invalid={invalid}
      disabled={disabled}
    />
  );
}

function CustomerPicker(props: ScopeEntityPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { options, isLoading } = useOrganizationOptions(debouncedSearch);
  return <PickerField {...props} options={options} onSearch={setSearch} loading={isLoading} />;
}

function DevicePicker(props: ScopeEntityPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // One object for the cache key and the request, as the ticket form's device picker does.
  const filter = useMemo(() => ({ statuses: [...DEFAULT_DEVICES_LIST_STATUSES] }), []);
  const query = useQuery({
    queryKey: deviceQueryKeys.page(filter, debouncedSearch, DEVICE_OPTIONS_LIMIT),
    queryFn: () => fetchDevicesPage({ filter, search: debouncedSearch, first: DEVICE_OPTIONS_LIMIT }),
    placeholderData: keepPreviousData,
  });
  const options = useMemo<AutocompleteOption[]>(
    () =>
      (query.data?.devices ?? []).map(device => ({
        label: getDeviceName(device) || device.machineId,
        value: device.machineId,
      })),
    [query.data],
  );
  return (
    <PickerField
      {...props}
      options={options}
      onSearch={setSearch}
      loading={query.isLoading}
      error={query.isError ? "Couldn't load devices" : undefined}
    />
  );
}

function TagPicker(props: ScopeEntityPickerProps) {
  // In a loading scope (its boundary's fallback) it is the field, locked, reading nothing.
  if (useLoadingScope()) return <PickerField {...props} options={NO_ITEMS} disabled loading />;
  return <TagPickerLive {...props} />;
}

function TagPickerLive(props: ScopeEntityPickerProps) {
  const data = useLazyLoadQuery<ScopeEntityPickerTagsQueryType>(
    scopeEntityPickerTagsQuery,
    {},
    { fetchPolicy: 'store-and-network' },
  );
  const options = useMemo<AutocompleteOption[]>(
    () => data.tagsByEntityType.map(tag => ({ value: tag.id, label: tag.key })),
    [data.tagsByEntityType],
  );
  return <PickerField {...props} options={options} />;
}
