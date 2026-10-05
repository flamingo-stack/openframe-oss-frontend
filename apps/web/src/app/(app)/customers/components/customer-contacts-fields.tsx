'use client';
'use no memo';

import { PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type Control, Controller, useFieldArray } from 'react-hook-form';
import { CONTACT_FIELD_LABELS, type CustomerFormData, EMPTY_CONTACT_ROW } from '../types/customer-form.types';
import { CustomerTabHeader } from './details-tabs/customer-tab-header';

interface CustomerContactsFieldsProps {
  control: Control<CustomerFormData>;
  disabled: boolean;
  showErrors: boolean;
}

const PLACEHOLDERS = {
  contactName: 'Jane Doe',
  title: 'IT Manager',
  email: 'name@company.com',
  phone: '+1-555-0123',
} as const;

const FIELD_TYPES = { contactName: 'text', title: 'text', email: 'email', phone: 'tel' } as const;

const CONTACT_FIELDS = ['contactName', 'title', 'email', 'phone'] as const;

/**
 * The "Contact Information" section: one row of four inputs per contact, a
 * trash button per row and "Add Contact" below. Rows can be removed down to
 * none — the single empty row a new (or contact-less) customer starts with is
 * a seed, not a floor; blank rows are dropped on submit. The list is ordered:
 * the first contact is the one the customers list and the worktime table show,
 * hence the hint under the heading.
 */
export function CustomerContactsFields({ control, disabled, showErrors }: CustomerContactsFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <CustomerTabHeader title="Contact Information" />
        <p className="text-ods-text-secondary text-h6">The first contact is the one shown in customer lists.</p>
      </div>

      {fields.length > 0 && (
        <div className="flex flex-col gap-[var(--spacing-system-lf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)]">
          {fields.map((row, index) => (
            // Below md the name shares its line with the trash button and the
            // other fields stack full-width; from md on all four sit in one row
            // with the trash at the end. Fixed 24px gaps keep the hanging error
            // text of one field clear of the next.
            <div key={row.id} className="flex flex-col gap-[var(--spacing-system-lf)] md:flex-row md:items-end">
              <div className="flex items-end gap-[var(--spacing-system-xsf)] md:contents">
                <div className="min-w-0 flex-1">
                  <ContactInput
                    control={control}
                    index={index}
                    field="contactName"
                    disabled={disabled}
                    showErrors={showErrors}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Remove contact"
                  leftIcon={<TrashIcon />}
                  className="shrink-0 md:order-last [&_svg]:!text-ods-error"
                  onClick={() => remove(index)}
                  disabled={disabled}
                />
              </div>
              {CONTACT_FIELDS.filter(field => field !== 'contactName').map(field => (
                <div key={field} className="min-w-0 flex-1">
                  <ContactInput
                    control={control}
                    index={index}
                    field={field}
                    disabled={disabled}
                    showErrors={showErrors}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="small"
        leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
        className="self-start"
        onClick={() => append(EMPTY_CONTACT_ROW)}
        disabled={disabled}
      >
        Add Contact
      </Button>
    </div>
  );
}

interface ContactInputProps {
  control: Control<CustomerFormData>;
  index: number;
  field: (typeof CONTACT_FIELDS)[number];
  disabled: boolean;
  showErrors: boolean;
}

function ContactInput({ control, index, field, disabled, showErrors }: ContactInputProps) {
  return (
    <Controller
      name={`contacts.${index}.${field}`}
      control={control}
      // `error` is read on every render (destructured): the read is what
      // subscribes the Controller to error changes.
      render={({ field: input, fieldState: { error } }) => (
        <Input
          type={FIELD_TYPES[field]}
          label={CONTACT_FIELD_LABELS[field]}
          placeholder={PLACEHOLDERS[field]}
          value={input.value}
          onChange={input.onChange}
          disabled={disabled}
          invalid={showErrors && !!error}
          error={showErrors ? error?.message : undefined}
        />
      )}
    />
  );
}
