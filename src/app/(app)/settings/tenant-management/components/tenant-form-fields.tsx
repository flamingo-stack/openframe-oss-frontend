'use client';
'use no memo';

import { Input, RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type Control, Controller } from 'react-hook-form';
import type { DirectoryProvider } from '../types/directory-enums';
import type { TenantFormData } from '../types/tenant-form.types';
import { PROVIDER_ORDER, providerPresentation } from '../utils/tenant-presentation';
import { CustomerSelect } from './customer-select';

// The fields of the New and Edit Tenant Integration forms (Figma 2097-122192 …
// 2097-123264), one file so the two pages cannot drift: the provider picker
// (grouped radio rows, as drawn), then Domain Name · Connection Name · Select
// Customer on a four-column grid — the domain spans two columns while it is
// shown, and Edit hides the provider and the domain (they sit in the identity
// card above). Field errors hang below their control out of flow (core
// `FieldWrapper`), so every gap here is the 24px that keeps them off the next row.

interface TenantFormFieldsProps {
  control: Control<TenantFormData>;
  /** Every control inert — a write in flight, or the record not loaded yet. */
  disabled?: boolean;
  /** The provider is fixed once a connection exists (a record has one). */
  providerLocked?: boolean;
  /** The domain is fixed once a consent link has been minted for it. */
  domainLocked?: boolean;
  hideProvider?: boolean;
  hideDomain?: boolean;
  /** Edit: the customer already bound to this connection (see `CustomerSelect`). */
  includeOrganizationId?: string;
  /** Edit: hold the customer list until the record is known. */
  customersEnabled?: boolean;
  /**
   * Providers this deployment offers (`directoryConnectionOptions.providers`),
   * shown in `PROVIDER_ORDER`; the copy for each is a client constant.
   */
  providers?: readonly DirectoryProvider[];
}

function providerOptions(providers: readonly DirectoryProvider[]) {
  return PROVIDER_ORDER.filter(provider => providers.includes(provider)).map(provider => {
    const { label, radioDescription } = providerPresentation(provider);
    return { value: provider, label, description: radioDescription };
  });
}

/**
 * One column on a phone, two at md (800px: a four-way split leaves 156px per
 * field, too narrow for its placeholder), four at lg — the frames' proportions.
 */
export const FIELD_GRID = 'grid grid-cols-1 gap-[var(--spacing-system-lf)] md:grid-cols-2 lg:grid-cols-4';

export function TenantFormFields({
  control,
  disabled = false,
  providerLocked = false,
  domainLocked = false,
  hideProvider = false,
  hideDomain = false,
  includeOrganizationId,
  customersEnabled = true,
  providers = PROVIDER_ORDER,
}: TenantFormFieldsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      {!hideProvider && (
        <Controller
          name="provider"
          control={control}
          render={({ field, fieldState }) => (
            <RadioGroupBlock
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              options={providerOptions(providers)}
              variant="grouped"
              disabled={disabled || providerLocked}
              error={fieldState.error?.message}
              aria-label="Provider"
            />
          )}
        />
      )}
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
                  // Show what will be sent: the schema trims and lowercases on
                  // submit, so the field does the same the moment focus leaves.
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
              includeOrganizationId={includeOrganizationId}
              enabled={customersEnabled}
            />
          )}
        />
      </div>
    </div>
  );
}
