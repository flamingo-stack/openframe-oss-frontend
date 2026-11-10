import { describe, expect, it, vi } from 'vitest';
import { DirectoryReadOnlyReason, DirectoryUserField, OrgUserSource } from '@/generated/schema-enums';

// The fragment sits beside the pure mappers under test; the tag would throw at module scope on import. Nothing here
// reads it. `readInlineData` hands the node back: the fixtures carry the nested fragments' fields flat.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));

import { type FixtureAccount, LIVE_DETAILS, userRecord as record } from './__tests__/edit-user-fixtures';
import {
  EDIT_USER_DEFAULT_VALUES,
  type EditUserFormData,
  type EditUserRecord,
  MANAGER_NOT_SYNCED,
  NO_CUSTOMER_REASON,
  editUserNotice,
  editUserSchema,
  fieldLocked,
  formFieldOfInput,
  providerFieldLocked,
  toEditUserRecord,
  showsLocationFields,
  toUpdateInput,
} from './edit-user-form';

const ALL_FIELDS = Object.values(DirectoryUserField);
const GOOGLE_FIELDS = [
  DirectoryUserField.FIRST_NAME,
  DirectoryUserField.LAST_NAME,
  DirectoryUserField.JOB_TITLE,
  DirectoryUserField.DEPARTMENT,
  DirectoryUserField.MANAGER,
  DirectoryUserField.BUSINESS_PHONES,
  DirectoryUserField.MOBILE_PHONE,
];

type Person = Parameters<typeof toEditUserRecord>[0];

function saved(stored: EditUserRecord, changes: Partial<EditUserFormData>) {
  return toUpdateInput(stored, { ...stored.values, ...changes });
}

describe('toEditUserRecord', () => {
  it('is null without an account', () => {
    expect(toEditUserRecord({ accounts: [] } as unknown as Person)).toBeNull();
  });

  it('seeds the form from the live read and the stored fields', () => {
    const { values, managerOption, liveRead } = record({ leavingDate: '2027-03-01' as FixtureAccount['leavingDate'] });
    expect(values).toMatchObject({ firstName: 'Olivia', jobTitle: 'Designer', usageLocation: 'GB', manager: 'acc-9' });
    expect(values.leavingDate).toEqual(new Date(2027, 2, 1));
    expect(managerOption).toEqual({ value: 'acc-9', label: 'Alan Johnson' });
    expect(liveRead).toBe(true);
  });

  it('names a manager who is not a synced account without giving them an id', () => {
    const details = { ...LIVE_DETAILS, manager: { accountId: null, displayName: 'Vendor', email: null } };
    const stored = record({ details });
    expect(stored.values.manager).toBe(MANAGER_NOT_SYNCED);
    expect(stored.managerOption).toEqual({ value: MANAGER_NOT_SYNCED, label: 'Vendor' });
    expect(saved(stored, {})).toBeNull();
  });

  it('has no manager when the provider names nobody', () => {
    const details = { ...LIVE_DETAILS, manager: null };
    expect(record({ details })).toMatchObject({ managerOption: null, values: { manager: null } });
  });
});

describe('toUpdateInput', () => {
  it('is null when nothing changed, so an untouched save sends nothing', () => {
    expect(saved(record(), {})).toBeNull();
  });

  it('is null without a customer: a write needs one', () => {
    expect(saved(record({ customers: [] }), { jobTitle: 'Lead' })).toBeNull();
  });

  it('sends only what changed, for the first claiming customer', () => {
    expect(saved(record(), { jobTitle: 'Lead' })).toEqual({ id: 'acc-1', organizationId: 'org-1', jobTitle: 'Lead' });
  });

  it('clears a text field with an empty string, not null: null means unchanged', () => {
    expect(saved(record(), { department: '' })).toMatchObject({ department: '' });
  });

  it('clears the manager and the leaving date with null', () => {
    const stored = record({ leavingDate: '2027-03-01' as FixtureAccount['leavingDate'] });
    expect(saved(stored, { manager: null, leavingDate: null })).toMatchObject({ managerId: null, leavingDate: null });
  });

  it('sends the leaving date as the picked local day', () => {
    expect(saved(record(), { leavingDate: new Date(2027, 0, 5) })).toMatchObject({ leavingDate: '2027-01-05' });
  });

  it('does not send a re-picked same day', () => {
    const stored = record({ leavingDate: '2027-03-01' as FixtureAccount['leavingDate'] });
    expect(saved(stored, { leavingDate: new Date(2027, 2, 1) })).toBeNull();
  });

  it('reads the stored values as the schema hands them back, so an untouched one with spaces is no change', () => {
    const stored = record({
      firstName: ' Olivia ',
      details: { ...LIVE_DETAILS, department: ' Design ', usageLocation: 'gb', mobilePhone: ' +1 555 ' },
    });
    expect(toUpdateInput(stored, editUserSchema(stored.values.usageLocation).parse(stored.values))).toBeNull();
  });

  it('never sends a field the provider does not take, whatever the form holds', () => {
    const stored = record({ source: OrgUserSource.GOOGLE_WORKSPACE, editableFields: GOOGLE_FIELDS });
    expect(saved(stored, { officeLocation: 'Leeds', jobTitle: 'Lead' })).toEqual({
      id: 'acc-1',
      organizationId: 'org-1',
      jobTitle: 'Lead',
    });
    expect(saved(record({ details: null }), { jobTitle: 'Lead' })).toBeNull();
  });

  describe('Phone', () => {
    const withPhones = (mobilePhone: string | null, businessPhones: string[]) => ({
      details: { ...LIVE_DETAILS, mobilePhone, businessPhones },
    });

    it('saves to the mobile number when that is what it showed', () => {
      const stored = record(withPhones('+1 555', ['+1 777']));
      expect(stored.values.phone).toBe('+1 555');
      expect(saved(stored, { phone: '+1 556' })).toMatchObject({ mobilePhone: '+1 556' });
      expect(saved(stored, { phone: '+1 556' })).not.toHaveProperty('businessPhones');
    });

    it('keeps the other business numbers of a Google user', () => {
      const stored = record(withPhones(null, ['+1 777', '+1 888']));
      expect(saved(stored, { phone: '+1 778' })).toMatchObject({ businessPhones: ['+1 778', '+1 888'] });
      expect(saved(stored, { phone: '' })).toMatchObject({ businessPhones: ['+1 888'] });
    });

    it('starts a number the provider does not have in the business list', () => {
      expect(saved(record(), { phone: '+1 777' })).toMatchObject({ businessPhones: ['+1 777'] });
    });

    it('clears a single business number with an empty list', () => {
      expect(saved(record(withPhones(null, ['+1 777'])), { phone: '' })).toMatchObject({ businessPhones: [] });
    });

    it('saves the local phone when only that one exists', () => {
      expect(saved(record({ phone: '+1 999' }), { phone: '+1 998' })).toMatchObject({ phone: '+1 998' });
    });

    it('saves an OpenFrame account to the local phone', () => {
      const stored = record({ source: OrgUserSource.OPENFRAME, details: null, editableFields: [] });
      expect(saved(stored, { phone: '+1 998' })).toMatchObject({ phone: '+1 998' });
    });
  });

  describe('display name', () => {
    it('follows the name parts on Microsoft when it was first + last', () => {
      expect(saved(record(), { lastName: 'Hart' })).toMatchObject({ lastName: 'Hart', displayName: 'Olivia Hart' });
    });

    it('stays when it was written by hand', () => {
      expect(saved(record({ displayName: 'O. Grant (Legal)' }), { lastName: 'Hart' })).not.toHaveProperty(
        'displayName',
      );
    });

    it('is never sent where the provider does not take it', () => {
      const stored = record({ source: OrgUserSource.GOOGLE_WORKSPACE, editableFields: GOOGLE_FIELDS });
      expect(saved(stored, { lastName: 'Hart' })).not.toHaveProperty('displayName');
    });

    it('stays when both name parts were cleared', () => {
      expect(saved(record(), { firstName: '', lastName: '' })).not.toHaveProperty('displayName');
    });

    it('is not sent when the name parts did not change', () => {
      expect(saved(record(), { jobTitle: 'Lead' })).not.toHaveProperty('displayName');
    });
  });
});

describe('locks', () => {
  it('locks what the provider does not take', () => {
    const stored = record({ editableFields: GOOGLE_FIELDS, source: OrgUserSource.GOOGLE_WORKSPACE });
    expect(providerFieldLocked(stored, DirectoryUserField.JOB_TITLE)).toBe(false);
    expect(providerFieldLocked(stored, DirectoryUserField.OFFICE_LOCATION)).toBe(true);
  });

  it('locks every provider field without a customer, without the live read, and while read-only', () => {
    expect(providerFieldLocked(record({ customers: [] }), DirectoryUserField.JOB_TITLE)).toBe(true);
    expect(providerFieldLocked(record({ details: null }), DirectoryUserField.JOB_TITLE)).toBe(true);
    expect(providerFieldLocked(record({ editableFields: [] }), DirectoryUserField.JOB_TITLE)).toBe(true);
  });

  it('locks a form field by the provider field it writes, as Save leaves it out', () => {
    const stored = record({ editableFields: ALL_FIELDS.filter(field => field !== DirectoryUserField.MANAGER) });
    expect(fieldLocked(stored, 'manager')).toBe(true);
    expect(fieldLocked(stored, 'jobTitle')).toBe(false);
    expect(saved(stored, { manager: 'acc-2', jobTitle: 'Lead' })).not.toHaveProperty('managerId');
  });

  it('locks Phone with the provider field it saves to', () => {
    const mobile = { details: { ...LIVE_DETAILS, mobilePhone: '+1 555' } };
    expect(fieldLocked(record(mobile), 'phone')).toBe(false);
    expect(fieldLocked(record({ ...mobile, editableFields: [] }), 'phone')).toBe(true);
    expect(fieldLocked(record({ editableFields: [] }), 'phone')).toBe(true);
    expect(saved(record({ ...mobile, editableFields: [] }), { phone: '+1 556' })).toBeNull();
  });

  it('keeps a stored local phone open on a failed read, and does not start one', () => {
    expect(fieldLocked(record({ details: null, phone: '+1 999' }), 'phone')).toBe(false);
    expect(fieldLocked(record({ details: null, phone: null }), 'phone')).toBe(true);
  });

  it('keeps the local phone of an OpenFrame account open', () => {
    const openFrame = { source: OrgUserSource.OPENFRAME, details: null, editableFields: [] };
    expect(fieldLocked(record(openFrame), 'phone')).toBe(false);
    expect(fieldLocked(record({ ...openFrame, customers: [] }), 'phone')).toBe(true);
  });

  it('shows the location fields on Microsoft only, also while they are locked', () => {
    expect(showsLocationFields(record({ editableFields: [] }))).toBe(true);
    expect(showsLocationFields(record({ source: OrgUserSource.GOOGLE_WORKSPACE }))).toBe(false);
    expect(showsLocationFields(record({ source: OrgUserSource.OPENFRAME }))).toBe(false);
  });
});

describe('editUserNotice', () => {
  it('says nothing when the form is open', () => {
    expect(editUserNotice(record())).toBeNull();
  });

  it('names the missing customer first', () => {
    const stored = record({ customers: [], readOnlyReasons: [DirectoryReadOnlyReason.PAUSED] });
    expect(editUserNotice(stored)?.description).toBe(NO_CUSTOMER_REASON);
  });

  it('names the first read-only reason', () => {
    const stored = record({
      editableFields: [],
      readOnlyReasons: [DirectoryReadOnlyReason.PAUSED, DirectoryReadOnlyReason.WRITE_NOT_ENABLED],
    });
    expect(editUserNotice(stored)).toEqual({ title: 'Directory fields are locked', description: 'The sync is paused' });
  });

  it('says what an OpenFrame account can change', () => {
    const stored = record({ source: OrgUserSource.OPENFRAME, details: null, editableFields: [] });
    expect(editUserNotice(stored)?.title).toBe('Added in OpenFrame');
  });

  it('says the directory could not be read', () => {
    expect(editUserNotice(record({ details: null }))?.description).toBe("Couldn't read this user from the directory.");
  });
});

describe('editUserSchema', () => {
  const parse = (changes: Partial<EditUserFormData>, stored = '') =>
    editUserSchema(stored).safeParse({ ...EDIT_USER_DEFAULT_VALUES, ...changes });

  it('trims text, so a space added around a value is not a change', () => {
    expect(parse({ jobTitle: '  Lead ' }).data?.jobTitle).toBe('Lead');
  });

  it("mirrors the backend's bounds", () => {
    expect(parse({ firstName: 'x'.repeat(65) }).success).toBe(false);
    expect(parse({ firstName: 'x'.repeat(64) }).success).toBe(true);
    expect(parse({ jobTitle: 'x'.repeat(129) }).success).toBe(false);
    expect(parse({ officeLocation: 'x'.repeat(128) }).success).toBe(true);
    expect(parse({ phone: 'x'.repeat(65) }).success).toBe(false);
  });

  it('takes a two-letter usage location and upper-cases it', () => {
    expect(parse({ usageLocation: 'gb' }).data?.usageLocation).toBe('GB');
    expect(parse({ usageLocation: 'GBR' }).success).toBe(false);
    expect(parse({ usageLocation: '1A' }).success).toBe(false);
  });

  it('refuses to clear a stored usage location, and leaves an unset one alone', () => {
    expect(parse({ usageLocation: '' }, 'GB').success).toBe(false);
    expect(parse({ usageLocation: '' }, '').success).toBe(true);
  });
});

describe('formFieldOfInput', () => {
  it('maps the wire fields onto the one form field they show in', () => {
    expect(formFieldOfInput('managerId')).toBe('manager');
    expect(formFieldOfInput('businessPhones')).toBe('phone');
    expect(formFieldOfInput('mobilePhone')).toBe('phone');
  });

  it('has no field for what the form does not draw', () => {
    expect(formFieldOfInput('displayName')).toBeNull();
    expect(formFieldOfInput(null)).toBeNull();
  });
});
