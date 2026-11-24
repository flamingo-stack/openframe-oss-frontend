'use client';
'use no memo';

import { Autocomplete } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo, useState } from 'react';
import { type Control, Controller, type UseFormSetValue, useWatch } from 'react-hook-form';
import { avatarStartAdornment, renderAvatarOption } from '@/app/(app)/tickets/components/avatar-autocomplete';
import {
  renderStatusOption,
  type StatusOption,
  statusStartAdornment,
} from '@/app/(app)/tickets/components/status-autocomplete';
import { useAssigneeOptions } from '@/app/(app)/tickets/hooks/use-assignee-options';
import { type AvatarOption, useOrganizationOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { useTicketStatusesQuery } from '@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query';
import { TICKET_STATUS_KIND } from '@/app/(app)/tickets/utils/ticket-statistics';
import type { MailboxDefaultsFormData, StoredDefaultOptions } from './mailbox-defaults';

const renderCustomerOption = renderAvatarOption('square');
const renderAssigneeOption = renderAvatarOption('round');

/** A list page holds one page of options: the stored value is pinned in so it keeps its label. */
function withOption<T extends { value: string }>(options: T[], pinned: T | null): T[] {
  if (!pinned || options.some(option => option.value === pinned.value)) return options;
  return [pinned, ...options];
}

interface MailboxDefaultsFieldsProps {
  control: Control<MailboxDefaultsFormData>;
  setValue: UseFormSetValue<MailboxDefaultsFormData>;
  disabled?: boolean;
  /** A saved mailbox's customer and status, pinned into the pickers so they keep their labels. */
  stored?: StoredDefaultOptions;
}

/**
 * "New tickets" (Figma 4527-132452, 4679-130269): Default Customer, Default Status and Default Assignee of the tickets
 * this mailbox creates. A known sender's company wins over the Default Customer; with none, unknown senders are held.
 * Default Status offers Tech Required and the custom statuses, the statuses a ticket may be created in.
 */
export function MailboxDefaultsFields({ control, setValue, disabled = false, stored }: MailboxDefaultsFieldsProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const customerOptions = useOrganizationOptions(debouncedCustomerSearch, !disabled);
  const [pickedCustomer, setPickedCustomer] = useState<AvatarOption | null>(null);
  const customerList = useMemo(
    () => withOption(withOption(customerOptions.options, pickedCustomer), stored?.customer ?? null),
    [customerOptions.options, pickedCustomer, stored],
  );

  const assigneeId = useWatch({ control, name: 'defaultAssigneeId' });
  const assigneeOptions = useAssigneeOptions({ selectedIds: [assigneeId], enabled: !disabled });

  const statusesQuery = useTicketStatusesQuery({ enabled: !disabled });
  const statusOptions = useMemo<StatusOption[]>(
    () =>
      withOption(
        (statusesQuery.data?.snapshot ?? [])
          .filter(status => !status.isSystem || status.kind === TICKET_STATUS_KIND.TECH_REQUIRED)
          .map(status => ({ label: status.name, value: status.id, color: status.color })),
        stored?.status ?? null,
      ),
    [statusesQuery.data, stored],
  );
  // Not set reads as Tech Required on the server: the picker says so instead of a blank field.
  const techRequiredId = statusesQuery.data?.systemStatuses.find(
    status => status.kind === TICKET_STATUS_KIND.TECH_REQUIRED,
  )?.id;
  const statusId = useWatch({ control, name: 'defaultStatusId' });
  useEffect(() => {
    if (!statusId && techRequiredId) setValue('defaultStatusId', techRequiredId);
  }, [statusId, techRequiredId, setValue]);

  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col">
        <h2 className="text-ods-text-primary text-h2">New tickets</h2>
        <p className="text-ods-text-secondary text-h6">
          Defaults for new tickets from this mailbox. If we know the sender&apos;s company, it is used instead of the
          default customer.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] content-md:grid-cols-3">
        <Controller
          name="defaultOrganizationId"
          control={control}
          render={({ field, fieldState }) => {
            const selected = customerList.find(option => option.value === field.value);
            return (
              <Autocomplete
                label="Default Customer"
                labelVariant="large"
                options={customerList}
                value={field.value ?? null}
                onChange={value => {
                  setPickedCustomer(customerList.find(option => option.value === value) ?? null);
                  field.onChange(value ?? null);
                }}
                onInputChange={setCustomerSearch}
                placeholder="Select Customer"
                loading={customerOptions.isLoading}
                disabled={disabled}
                disableClientFilter
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                startAdornment={avatarStartAdornment(selected, 'square')}
                renderOption={renderCustomerOption}
              />
            );
          }}
        />
        <Controller
          name="defaultStatusId"
          control={control}
          render={({ field, fieldState }) => {
            const selected = statusOptions.find(option => option.value === field.value);
            return (
              <Autocomplete
                label="Default Status"
                labelVariant="large"
                options={statusOptions}
                value={field.value ?? null}
                onChange={value => field.onChange(value ?? techRequiredId ?? null)}
                placeholder="Select Status"
                loading={statusesQuery.isLoading}
                disabled={disabled}
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                startAdornment={statusStartAdornment(selected)}
                renderOption={renderStatusOption}
              />
            );
          }}
        />
        <Controller
          name="defaultAssigneeId"
          control={control}
          render={({ field, fieldState }) => {
            const selected = assigneeOptions.options.find(option => option.value === field.value);
            return (
              <Autocomplete
                label="Default Assignee"
                labelVariant="large"
                options={assigneeOptions.options}
                value={field.value ?? null}
                onChange={value => field.onChange(value ?? null)}
                onInputChange={assigneeOptions.onSearchChange}
                placeholder="Select Assignee"
                loading={assigneeOptions.isLoading}
                disabled={disabled}
                disableClientFilter
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
                startAdornment={avatarStartAdornment(selected, 'round')}
                renderOption={renderAssigneeOption}
              />
            );
          }}
        />
      </div>
    </section>
  );
}
