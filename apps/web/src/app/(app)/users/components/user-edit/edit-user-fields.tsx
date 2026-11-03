'use client';
'use no memo';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Autocomplete,
  type AutocompleteOption,
  DatePicker,
  FieldWrapper,
  Input,
  SquareAvatar,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type Control, Controller, type UseFormReturn } from 'react-hook-form';
import { TenantNotice } from '@/app/(app)/cloud-tenant-management/components/tenant-detail/tenant-notice';
import { noop } from '@/app/components/shared';
import { DirectoryUserField } from '@/generated/schema-enums';
import {
  type EditUserCustomer,
  type EditUserFormData,
  type EditUserRecord,
  editUserNotice,
  phoneLocked,
  providerFieldLocked,
  showsLocationFields,
} from './edit-user-form';
import { ManagerField } from './manager-field';

// Field errors hang below their control out of flow (core `FieldWrapper`), so every gap is the 24px that keeps them
// off the next row. The DOM order is the phone's and the tablet's (Figma 1104:87693, 1104:3); from content-lg Customer
// leads the first row and Office Location starts a new one (1040:37391).
const FIELD_GRID = 'grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-2 content-lg:grid-cols-3';

const LEAVING_DATE_ID = 'edit-user-leaving-date';

type TextFieldName =
  'firstName' | 'lastName' | 'department' | 'jobTitle' | 'phone' | 'officeLocation' | 'usageLocation';

function TextField({
  control,
  name,
  label,
  placeholder,
  disabled,
  maxLength,
}: {
  control: Control<EditUserFormData>;
  name: TextFieldName;
  label: string;
  placeholder: string;
  disabled: boolean;
  maxLength?: number;
}) {
  // `disabled` goes on the core input, never on the Controller: react-hook-form would strip the field from the
  // submitted values, and the diff would read it as cleared.
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Input
          label={label}
          labelVariant="large"
          aria-label={label}
          placeholder={placeholder}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          maxLength={maxLength}
          invalid={!!error}
          error={error?.message}
        />
      )}
    />
  );
}

function customerOption({ id, name, imageUrl }: EditUserCustomer): AutocompleteOption<string> {
  return {
    value: id,
    label: name,
    icon: <SquareAvatar src={imageUrl} alt={name} fallback={name} size="sm" variant="square" />,
  };
}

/**
 * Read-only, from the rules (P2 closed): one claim is Figma's disabled select, several are all of them. Those are
 * text: the lib's multiple select prompts "Add More..." even while disabled.
 */
function CustomerField({ customers }: { customers: EditUserCustomer[] }) {
  if (customers.length > 1) {
    return (
      <Input
        label="Customer"
        labelVariant="large"
        value={customers.map(customer => customer.name).join(', ')}
        disabled
      />
    );
  }
  return (
    <Autocomplete
      label="Customer"
      labelVariant="large"
      options={customers.map(customerOption)}
      value={customers[0]?.id ?? null}
      onChange={noop}
      placeholder="No customer"
      disabled
    />
  );
}

interface EditUserFieldsProps {
  form: UseFormReturn<EditUserFormData>;
  /** Null until the record has seeded the form: the fields draw their own loading state. */
  record: EditUserRecord | null;
  /** A write is in flight. */
  disabled: boolean;
}

/** The form's fields (Figma 1040:37391). A field the provider does not take stays visible, locked. */
export function EditUserFields({ form: { control }, record, disabled }: EditUserFieldsProps) {
  const notice = record ? editUserNotice(record) : null;
  const locked = (field: DirectoryUserField) => disabled || !record || providerFieldLocked(record, field);
  const customerId = record?.customers[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      {notice && (
        <TenantNotice icon={<AlertTriangleIcon size={24} />} title={notice.title} description={notice.description} />
      )}
      <div className={FIELD_GRID}>
        <TextField
          control={control}
          name="firstName"
          label="First Name"
          placeholder="Enter First Name"
          disabled={locked(DirectoryUserField.FIRST_NAME)}
        />
        <TextField
          control={control}
          name="lastName"
          label="Last Name"
          placeholder="Enter Last Name"
          disabled={locked(DirectoryUserField.LAST_NAME)}
        />
        <div className="min-w-0 content-lg:order-first">
          <CustomerField customers={record?.customers ?? []} />
        </div>
        <TextField
          control={control}
          name="department"
          label="Department"
          placeholder="Enter Department"
          disabled={locked(DirectoryUserField.DEPARTMENT)}
        />
        <TextField
          control={control}
          name="jobTitle"
          label="Job Title"
          placeholder="Enter Job Title"
          disabled={locked(DirectoryUserField.JOB_TITLE)}
        />
        <Controller
          name="manager"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <ManagerField
              accountId={record?.accountId ?? null}
              connectionId={record?.connectionId ?? null}
              customerId={customerId}
              value={field.value}
              onChange={field.onChange}
              selected={record?.managerOption ?? null}
              error={error?.message}
              locked={!record || providerFieldLocked(record, DirectoryUserField.MANAGER)}
              disabled={disabled}
            />
          )}
        />
        {/* Not in the input: people are merged by primary email, so a change here would re-key the person. */}
        <Input
          label="Email"
          labelVariant="large"
          aria-label="Email"
          value={record?.email ?? ''}
          placeholder="No email"
          disabled
        />
        <TextField
          control={control}
          name="phone"
          label="Phone"
          placeholder="Enter Phone"
          disabled={disabled || !record || phoneLocked(record)}
        />
        {showsLocationFields(record) && (
          <>
            <div className="min-w-0 content-lg:col-start-1">
              <TextField
                control={control}
                name="officeLocation"
                label="Office Location"
                placeholder="Enter Office Location"
                disabled={locked(DirectoryUserField.OFFICE_LOCATION)}
              />
            </div>
            <TextField
              control={control}
              name="usageLocation"
              label="Usage Location"
              placeholder="Enter Usage Location"
              maxLength={2}
              disabled={locked(DirectoryUserField.USAGE_LOCATION)}
            />
          </>
        )}
        <Controller
          name="leavingDate"
          control={control}
          render={({ field, fieldState: { error } }) => (
            // A local field: it saves on a read-only account too (contract §11.5), never reaching the provider.
            <FieldWrapper label="Leaving date" labelVariant="large" htmlFor={LEAVING_DATE_ID} error={error?.message}>
              <DatePicker
                id={LEAVING_DATE_ID}
                mode="single"
                placeholder="MM/DD/YYYY"
                value={field.value ?? undefined}
                onChange={date => field.onChange(date ?? null)}
                invalid={!!error}
                disabled={disabled || !customerId}
              />
            </FieldWrapper>
          )}
        />
      </div>
    </div>
  );
}
