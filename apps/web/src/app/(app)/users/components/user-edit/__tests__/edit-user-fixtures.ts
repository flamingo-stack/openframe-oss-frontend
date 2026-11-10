/**
 * The account the Edit User tests edit. It carries the nested fragments' fields flat, so every test that reads it
 * mocks `readInlineData` to hand the node back.
 */
import type { customerOption_organization$data } from '@/__generated__/customerOption_organization.graphql';
import type { userPhone_account$data } from '@/__generated__/userPhone_account.graphql';
import { DirectoryUserField, OrgUserSource } from '@/generated/schema-enums';
import { type EditUserRecord, toEditUserRecord } from '../edit-user-form';

type Person = Parameters<typeof toEditUserRecord>[0];
type PersonAccount = Person['accounts'][number];

export type FixtureAccount = Omit<PersonAccount, ' $fragmentSpreads' | 'customers' | 'details'> &
  Omit<userPhone_account$data, ' $fragmentType' | 'details'> & {
    customers: readonly { organization: Omit<customerOption_organization$data, ' $fragmentType'> }[];
    details: (NonNullable<PersonAccount['details']> & NonNullable<userPhone_account$data['details']>) | null;
  };

/** The provider's answer to the live read. */
export const LIVE_DETAILS = {
  jobTitle: 'Designer',
  department: 'Design',
  officeLocation: null,
  usageLocation: 'GB',
  businessPhones: [],
  mobilePhone: null,
  manager: { accountId: 'acc-9', displayName: 'Alan Johnson', email: 'alan@contoso.com' },
} satisfies NonNullable<FixtureAccount['details']>;

/** Olivia Grant, a Microsoft 365 account Northbridge claims, every field open. */
function fixtureAccount(overrides: Partial<FixtureAccount> = {}): FixtureAccount {
  return {
    id: 'acc-1',
    source: OrgUserSource.MICROSOFT_365,
    email: 'olivia@contoso.com',
    signInName: 'olivia@contoso.com',
    displayName: 'Olivia Grant',
    firstName: 'Olivia',
    lastName: 'Grant',
    phone: null,
    leavingDate: null,
    readOnlyReasons: [],
    editableFields: Object.values(DirectoryUserField),
    connection: { id: 'conn-1' },
    customers: [{ organization: { organizationId: 'org-1', name: 'Northbridge', image: null } }],
    details: LIVE_DETAILS,
    ...overrides,
  };
}

/** The record the page reads from that account. */
export function userRecord(overrides: Partial<FixtureAccount> = {}): EditUserRecord {
  // The one cast: the generated type carries fragment refs where the fixture has their fields.
  const read = toEditUserRecord({ accounts: [fixtureAccount(overrides)] } as unknown as Person);
  if (!read) throw new Error('no record');
  return read;
}
