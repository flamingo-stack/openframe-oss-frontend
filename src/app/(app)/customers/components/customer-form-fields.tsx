'use client';
'use no memo';

import { CheckboxBlock, Input, Textarea } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import type { CustomerFormData } from '../types/customer-form.types';
import { CustomerContactsFields } from './customer-contacts-fields';

interface CustomerFormFieldsProps {
  form: UseFormReturn<CustomerFormData>;
  /**
   * Disable every control. The edit page passes this while the record is still
   * loading, so the real empty form doubles as the loading state and nothing
   * typed before the seed can dirty the form (the seed is dirty-guarded).
   */
  disabled: boolean;
  /** Inline errors are hidden on a pristine form; the first Save attempt flips this. */
  showErrors: boolean;
  /** The logo uploader (SaaS only) — rendered beside name/website on wide screens. */
  logoSlot?: ReactNode;
}

const ADDRESS_PLACEHOLDER = '123 Main St, City, State, ZIP';

export function CustomerFormFields({ form, disabled, showErrors, logoSlot }: CustomerFormFieldsProps) {
  const { control, setValue, getValues } = form;
  const mailingSameAsPhysical = useWatch({ control, name: 'mailingSameAsPhysical' });

  // `disabled` goes on the core inputs, never on the Controller: react-hook-form
  // strips a Controller-disabled field from the submitted data and ignores
  // setValue on it — the mirrored mailing address would silently vanish.
  //
  // `fieldState.error` is read on every render (destructured), not only once
  // `showErrors` is on: the read is what subscribes the Controller to error
  // changes, so the first Save attempt can paint the field red.
  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-lf)]">
      {/* Row 1: name + website (left) | logo (right on lg, below on md/sm) */}
      <div className="flex flex-col items-stretch gap-[var(--spacing-system-lf)] lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-lf)] md:flex-row lg:flex-col">
          <div className="min-w-0 flex-1">
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <Input
                  label="Customer Name"
                  placeholder="Customer Name"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                  invalid={showErrors && !!error}
                  error={showErrors ? error?.message : undefined}
                />
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <Controller
              name="website"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <Input
                  label="Website URL"
                  placeholder="https://www.website.com"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                  invalid={showErrors && !!error}
                  error={showErrors ? error?.message : undefined}
                />
              )}
            />
          </div>
        </div>

        {logoSlot && <div className="w-full shrink-0 lg:w-[316px]">{logoSlot}</div>}
      </div>

      <Controller
        name="notes"
        control={control}
        render={({ field }) => (
          <Textarea
            label="Notes"
            rows={4}
            placeholder="Your notes here..."
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            className="min-h-[96px] resize-y"
          />
        )}
      />

      {/* Row 3: physical address + same-as-physical checkbox. While the box is
          on, the mailing line mirrors every keystroke here in the same event —
          an effect would lag the two inputs one character apart. */}
      <div className="flex flex-col gap-[var(--spacing-system-mf)] md:flex-row md:items-end md:gap-[var(--spacing-system-lf)]">
        <div className="min-w-0 flex-1">
          <Controller
            name="physicalAddress"
            control={control}
            render={({ field }) => (
              <Input
                label="Physical Address"
                placeholder={ADDRESS_PLACEHOLDER}
                value={field.value}
                onChange={event => {
                  field.onChange(event);
                  if (getValues('mailingSameAsPhysical')) {
                    setValue('mailingAddress', event.target.value, { shouldDirty: true, shouldValidate: true });
                  }
                }}
                disabled={disabled}
              />
            )}
          />
        </div>
        <Controller
          name="mailingSameAsPhysical"
          control={control}
          render={({ field }) => (
            <CheckboxBlock
              id="mailing-same"
              className="min-w-0 flex-1 md:max-w-[50%]"
              label="Mailing Address Same as Physical"
              checked={field.value}
              onCheckedChange={checked => {
                field.onChange(checked);
                // Turning the box on copies the physical address over; turning it
                // off leaves the copied text in place for editing.
                if (checked) {
                  setValue('mailingAddress', getValues('physicalAddress'), { shouldDirty: true, shouldValidate: true });
                }
              }}
              disabled={disabled}
            />
          )}
        />
      </div>

      <Controller
        name="mailingAddress"
        control={control}
        render={({ field }) => (
          <Input
            label="Mailing Address"
            placeholder={ADDRESS_PLACEHOLDER}
            value={field.value}
            onChange={field.onChange}
            disabled={disabled || mailingSameAsPhysical}
          />
        )}
      />

      <CustomerContactsFields control={control} disabled={disabled} showErrors={showErrors} />
    </div>
  );
}
