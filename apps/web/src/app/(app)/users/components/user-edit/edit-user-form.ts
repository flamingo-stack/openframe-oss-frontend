import { graphql, readInlineData } from 'react-relay';
import { z } from 'zod';
import type { editUserForm_person$data, editUserForm_person$key } from '@/__generated__/editUserForm_person.graphql';
import type { UpdateDirectoryUserInput } from '@/__generated__/useEditUserFormMutation.graphql';
import { DirectoryUserField, OrgUserSource } from '@/generated/schema-enums';
import { toCustomerOption } from '@/graphql/directory/customer-option';
import { presentationFor } from '@/lib/exhaustive-map';
import { parseLocalDate, toLocalDate } from '@/lib/graphql-scalars';
import { getFullImageUrl } from '@/lib/image-url';
import { readOnlyTooltip } from '../../utils/group-presentation';
import { type PhoneTarget, readUserPhone } from '../../utils/user-phone';

const editUserFormFragment = graphql`
  fragment editUserForm_person on DirectoryPerson @inline {
    accounts {
      id
      source
      email
      displayName
      firstName
      lastName
      leavingDate
      readOnlyReasons
      editableFields
      connection {
        id
      }
      customers {
        organization {
          ...customerOption_organization
        }
      }
      ...userPhone_account
      details {
        jobTitle
        department
        officeLocation
        usageLocation
        manager {
          accountId
          displayName
          email
        }
      }
    }
  }
`;

export const EDIT_USER_TITLE = 'Edit User';

/** Writes need a customer the account is visible to (contract §6), so an account nobody claims cannot be saved. */
export const NO_CUSTOMER_REASON = "No customer claims this user yet, so it can't be edited.";

/** The picker's value for a manager the provider names who is not a synced account here: nothing to send until changed. */
export const MANAGER_NOT_SYNCED = 'not-synced';

const text = (label: string, max: number) => z.string().trim().max(max, `${label} can be at most ${max} characters`);

/**
 * Mirrors the backend's bounds (contract §4). `usageLocation` cannot be cleared once set: Graph refuses it while the
 * user has licenses, and an empty one fails the backend's two-letter pattern.
 */
export function editUserSchema(storedUsageLocation: string) {
  return z.object({
    firstName: text('First name', 64),
    lastName: text('Last name', 64),
    department: text('Department', 64),
    jobTitle: text('Job title', 128),
    manager: z.string().nullable(),
    phone: text('Phone', 64),
    officeLocation: text('Office location', 128),
    usageLocation: z
      .string()
      .trim()
      .toUpperCase()
      .refine(value => (value === '' ? storedUsageLocation === '' : /^[A-Z]{2}$/.test(value)), {
        message: 'Enter a two-letter country code, such as GB',
      }),
    leavingDate: z.date().nullable(),
  });
}

export type EditUserFormData = z.infer<ReturnType<typeof editUserSchema>>;

export const EDIT_USER_DEFAULT_VALUES: EditUserFormData = {
  firstName: '',
  lastName: '',
  department: '',
  jobTitle: '',
  manager: null,
  phone: '',
  officeLocation: '',
  usageLocation: '',
  leavingDate: null,
};

export interface EditUserCustomer {
  id: string;
  name: string;
  imageUrl?: string;
}

/** What the page knows about the account it edits, read once per record so `useSeedForm` seeds once per answer. */
export interface EditUserRecord {
  accountId: string;
  source: string;
  displayName: string;
  email: string | null;
  connectionId: string | null;
  customers: EditUserCustomer[];
  readOnlyReasons: readonly string[];
  editableFields: readonly string[];
  /** The provider answered: without it the current values of its fields are unknown. */
  liveRead: boolean;
  managerOption: { value: string; label: string } | null;
  phoneTarget: PhoneTarget;
  /** A Google user's other business numbers: the field shows one, the write sends the whole list. */
  otherBusinessPhones: readonly string[];
  values: EditUserFormData;
}

type Person = Omit<editUserForm_person$data, ' $fragmentType'>;

/** The selected account: `directoryUser` puts the requested one first (contract §1). Null when there is none. */
export function toEditUserRecord(person: Person): EditUserRecord | null {
  const [account] = person.accounts;
  if (!account) return null;
  const details = account.details;
  const manager = details?.manager;
  const managerLabel = manager?.displayName ?? manager?.email ?? null;
  const { phone, target: phoneTarget, otherBusinessPhones } = readUserPhone(account);
  const managerValue = managerLabel ? (manager?.accountId ?? MANAGER_NOT_SYNCED) : null;
  return {
    accountId: account.id,
    source: account.source,
    displayName: account.displayName,
    email: account.email ?? null,
    connectionId: account.connection?.id ?? null,
    customers: account.customers.map(claim => {
      const { organizationId, name, image } = toCustomerOption(claim.organization);
      return { id: organizationId, name, imageUrl: getFullImageUrl(image?.imageUrl, image?.hash) };
    }),
    readOnlyReasons: account.readOnlyReasons,
    editableFields: account.editableFields,
    liveRead: details != null,
    managerOption: managerValue && managerLabel ? { value: managerValue, label: managerLabel } : null,
    phoneTarget,
    otherBusinessPhones,
    values: {
      firstName: account.firstName ?? '',
      lastName: account.lastName ?? '',
      department: details?.department ?? '',
      jobTitle: details?.jobTitle ?? '',
      manager: managerValue,
      phone,
      officeLocation: details?.officeLocation ?? '',
      usageLocation: details?.usageLocation ?? '',
      leavingDate: account.leavingDate ? parseLocalDate(account.leavingDate) : null,
    },
  };
}

export function readEditUserRecord(ref: editUserForm_person$key): EditUserRecord | null {
  return toEditUserRecord(readInlineData(editUserFormFragment, ref));
}

/**
 * A provider field stays locked without a customer, without the live read (its current value is unknown, so an edit
 * would be blind) and when the provider or the connection does not take it (`editableFields`, empty while read-only).
 */
export function providerFieldLocked(record: EditUserRecord, field: DirectoryUserField): boolean {
  return record.customers.length === 0 || !record.liveRead || !record.editableFields.includes(field);
}

function phoneLocked(record: EditUserRecord): boolean {
  if (record.phoneTarget === 'mobile') return providerFieldLocked(record, DirectoryUserField.MOBILE_PHONE);
  if (record.phoneTarget === 'business') return providerFieldLocked(record, DirectoryUserField.BUSINESS_PHONES);
  // A failed read of a provider account: a local number started now would sit under the provider's unread one.
  return record.customers.length === 0 || (record.source !== OrgUserSource.OPENFRAME && record.values.phone === '');
}

/** Office and usage location are Microsoft's: Google keeps neither as a user field, whatever the account's state. */
export function showsLocationFields(record: EditUserRecord | null): boolean {
  return record?.source !== OrgUserSource.GOOGLE_WORKSPACE && record?.source !== OrgUserSource.OPENFRAME;
}

/** Why part of the form is locked; null when every field the provider takes is open. */
export function editUserNotice(record: EditUserRecord): { title: string; description: string } | null {
  if (record.customers.length === 0) return { title: 'This user cannot be edited', description: NO_CUSTOMER_REASON };
  if (record.readOnlyReasons.length > 0) {
    return { title: 'Directory fields are locked', description: readOnlyTooltip(record.readOnlyReasons) };
  }
  if (record.source === OrgUserSource.OPENFRAME) {
    return { title: 'Added in OpenFrame', description: 'Only the phone and the leaving date can be changed here.' };
  }
  if (!record.liveRead) {
    return { title: 'Directory fields are locked', description: "Couldn't read this user from the directory." };
  }
  return null;
}

function phoneInput(record: EditUserRecord, phone: string): Partial<UpdateDirectoryUserInput> {
  if (record.phoneTarget === 'mobile') return { mobilePhone: phone };
  if (record.phoneTarget === 'local') return { phone };
  return { businessPhones: phone ? [phone, ...record.otherBusinessPhones] : [...record.otherBusinessPhones] };
}

const fullName = (first: string, last: string) => [first, last].filter(Boolean).join(' ');

/**
 * Microsoft's display name does not follow its name parts (Google derives its own), and the app's title reads it. It
 * follows the ones Save sends only when it was exactly first + last; one written by hand stays.
 */
function followingDisplayName(
  record: EditUserRecord,
  stored: EditUserFormData,
  changes: Partial<UpdateDirectoryUserInput>,
): string | undefined {
  if (providerFieldLocked(record, DirectoryUserField.DISPLAY_NAME)) return undefined;
  const was = fullName(stored.firstName, stored.lastName);
  const next = fullName(changes.firstName ?? stored.firstName, changes.lastName ?? stored.lastName);
  return record.displayName === was && next !== '' && next !== was ? next : undefined;
}

const TEXT_FIELDS = ['firstName', 'lastName', 'department', 'jobTitle', 'officeLocation', 'usageLocation'] as const;

/** The provider field each form field writes; Phone's follows the number it shows (`phoneLocked`). */
const PROVIDER_FIELD = {
  firstName: DirectoryUserField.FIRST_NAME,
  lastName: DirectoryUserField.LAST_NAME,
  department: DirectoryUserField.DEPARTMENT,
  jobTitle: DirectoryUserField.JOB_TITLE,
  officeLocation: DirectoryUserField.OFFICE_LOCATION,
  usageLocation: DirectoryUserField.USAGE_LOCATION,
  manager: DirectoryUserField.MANAGER,
} as const satisfies Record<(typeof TEXT_FIELDS)[number] | 'manager', DirectoryUserField>;

/** A form field the provider can lock: one that writes one provider field, or Phone. */
export type LockableFormField = keyof typeof PROVIDER_FIELD | 'phone';

/** What the form shows as locked and what Save leaves out: one rule for both. */
export function fieldLocked(record: EditUserRecord, field: LockableFormField): boolean {
  return field === 'phone' ? phoneLocked(record) : providerFieldLocked(record, PROVIDER_FIELD[field]);
}

/**
 * The stored values as the schema hands them back on submit (trimmed, the usage location upper-cased), so a value
 * the form returns untouched is no change. One the schema refuses stays as stored: the submit fails on it anyway.
 */
function submittedValues(record: EditUserRecord): EditUserFormData {
  const { shape } = editUserSchema(record.values.usageLocation);
  const values = { ...record.values };
  for (const field of [...TEXT_FIELDS, 'phone'] as const) {
    values[field] = shape[field].safeParse(values[field]).data ?? values[field];
  }
  return values;
}

const leavingDay = (date: Date | null) => (date ? toLocalDate(date) : null);

/**
 * What Save sends, or null when there is nothing to send. Only what changed goes out, and only where the provider
 * takes it: an absent field is unchanged (contract §11.5), so nothing the form did not touch, and nothing a locked
 * field holds, can overwrite the provider. `''` clears a provider text field; only `managerId` and `leavingDate`
 * clear on null.
 */
export function toUpdateInput(record: EditUserRecord, values: EditUserFormData): UpdateDirectoryUserInput | null {
  const [customer] = record.customers;
  if (!customer) return null;
  const stored = submittedValues(record);
  const changes: Partial<UpdateDirectoryUserInput> = {};
  for (const field of TEXT_FIELDS) {
    if (!fieldLocked(record, field) && values[field] !== stored[field]) changes[field] = values[field];
  }
  const displayName = followingDisplayName(record, stored, changes);
  if (displayName) changes.displayName = displayName;
  if (!fieldLocked(record, 'manager') && values.manager !== stored.manager) changes.managerId = values.manager;
  if (!fieldLocked(record, 'phone') && values.phone !== stored.phone) {
    Object.assign(changes, phoneInput(record, values.phone));
  }
  const day = leavingDay(values.leavingDate);
  if (day !== leavingDay(stored.leavingDate)) changes.leavingDate = day;
  if (Object.keys(changes).length === 0) return null;
  return { id: record.accountId, organizationId: customer.id, ...changes };
}

const FORM_FIELD_OF_INPUT = {
  firstName: 'firstName',
  lastName: 'lastName',
  department: 'department',
  jobTitle: 'jobTitle',
  managerId: 'manager',
  businessPhones: 'phone',
  mobilePhone: 'phone',
  phone: 'phone',
  officeLocation: 'officeLocation',
  usageLocation: 'usageLocation',
  leavingDate: 'leavingDate',
} as const satisfies Partial<Record<keyof UpdateDirectoryUserInput, keyof EditUserFormData>>;

/** The form field a `userErrors[].field` names; `displayName` has none, and neither does an unknown one. */
export function formFieldOfInput(field: string | null | undefined): keyof EditUserFormData | null {
  return presentationFor(FORM_FIELD_OF_INPUT, field) ?? null;
}
