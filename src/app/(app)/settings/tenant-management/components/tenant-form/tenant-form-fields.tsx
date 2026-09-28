'use client';
'use no memo';

import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { type Control, Controller } from 'react-hook-form';
import type { CustomerOption } from './customer-option';
import { CustomerSelect } from './customer-select';
import type { TenantFormData } from './tenant-form.types';

// The fields of the New and Edit forms, one file so the two pages cannot drift: the provider slot,
// then Domain · Connection Name · Customer on the grid. Field errors hang below their control out of
// flow (core `FieldWrapper`), so every gap is the 24px that keeps them off the next row.

interface TenantFormFieldsProps {
  control: Control<TenantFormData>;
  /** Every control inert — a write in flight, or the record not loaded yet. */
  disabled?: boolean;
  /** The domain is fixed once a consent link has been minted for it. */
  domainLocked?: boolean;
  /** Edit shows the domain in the identity card above instead. */
  hideDomain?: boolean;
  /** The New page's provider picker, above the grid. */
  providerField?: ReactNode;
  /** The customer already bound to this connection (see `CustomerSelect`). */
  includeOrganization?: CustomerOption | null;
  /** Edit: hold the customer list until the record is known (see `CustomerSelect.enabled`). */
  customersEnabled?: boolean;
}

/** One column on a phone, two at md (a four-way split is too narrow there), four at lg — the frames' proportions. */
export const FIELD_GRID = 'grid grid-cols-1 gap-[var(--spacing-system-lf)] md:grid-cols-2 lg:grid-cols-4';

export function TenantFormFields({
  control,
  disabled = false,
  domainLocked = false,
  hideDomain = false,
  providerField,
  includeOrganization,
  customersEnabled = true,
}: TenantFormFieldsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      {providerField}
      <div className={FIELD_GRID}>
        {!hideDomain && (
          <Controller
            name="domain"
            control={control}
            render={({ field, fieldState }) => (
              <div className="md:col-span-2">
                <Input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  label="Domain Name"
                  labelVariant="large"
                  placeholder="Enter Domain Name"
                  value={field.value}
                  onChange={field.onChange}
                  // Show what will be sent: the schema trims and lowercases on submit.
                  onBlur={() => {
                    const normalized = field.value.trim().toLowerCase();
                    if (normalized !== field.value) field.onChange(normalized);
                    field.onBlur();
                  }}
                  disabled={disabled || domainLocked}
                  error={fieldState.error?.message}
                  invalid={!!fieldState.error}
                />
              </div>
            )}
          />
        )}
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              type="text"
              label="Connection Name"
              labelVariant="large"
              placeholder="Enter Connection Name"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
            />
          )}
        />
        <Controller
          name="organizationId"
          control={control}
          render={({ field, fieldState }) => (
            <CustomerSelect
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
              includeOrganization={includeOrganization}
              enabled={customersEnabled}
            />
          )}
        />
      </div>
    </div>
  );
}
