'use client';
'use no memo';

import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { type Control, Controller } from 'react-hook-form';
import type { TenantFormData } from './tenant-form.types';

// The connection's own fields, one file so the pages cannot drift: the provider slot, then
// Primary Domain Name · Connection Name (Figma 3562-27579). Its customers are `AttributionFields`.
// Field errors hang below their control out of flow (core `FieldWrapper`), so every gap is the
// 24px that keeps them off the next row.

interface TenantFormFieldsProps {
  control: Control<TenantFormData>;
  /** Every control inert — a write in flight, or the record not loaded yet. */
  disabled?: boolean;
  /** The domain is fixed once a consent link has been minted for it. */
  domainLocked?: boolean;
  /** Edit shows the domain in the identity card above instead: the name takes the row. */
  hideDomain?: boolean;
  /** The New page's provider picker, above the grid. */
  providerField?: ReactNode;
}

/** One column on a phone, the two fields side by side from md. */
const FIELD_GRID = 'grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-2';

export function TenantFormFields({
  control,
  disabled = false,
  domainLocked = false,
  hideDomain = false,
  providerField,
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
              <Input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                label="Primary Domain Name"
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
            )}
          />
        )}
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <div className={hideDomain ? 'content-md:col-span-2' : undefined}>
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
            </div>
          )}
        />
      </div>
    </div>
  );
}
