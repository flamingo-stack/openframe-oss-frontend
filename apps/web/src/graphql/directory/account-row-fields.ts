import { graphql, readInlineData } from 'react-relay';
import type { accountRowFields_account$key } from '@/__generated__/accountRowFields_account.graphql';
import type { UserRow } from '@/app/(app)/users/components/users-list/user-row-cells';
import { providerMarks } from '@/app/(app)/users/utils/user-presentation';
import { routes } from '@/lib/routes';
import { toClaimingCustomer } from './customer-claim-fields';

/**
 * One directory account as a user row's User and Customer cells draw it: a device's Users tab and a group's members.
 * The Users list cannot spread it: its row is a person, whose name, marks and customers are merged over the accounts.
 */
export const accountRowFieldsFragment = graphql`
  fragment accountRowFields_account on DirectoryAccount @inline {
    id
    displayName
    email
    source
    customers {
      ...customerClaimFields_claim
    }
  }
`;

/** The part of a `UserRow` an account fills, every field of it read. */
export type AccountRow = Required<Pick<UserRow, 'id' | 'href' | 'name' | 'email' | 'providers' | 'customers'>>;

export function toAccountRow(ref: accountRowFields_account$key): AccountRow {
  const account = readInlineData(accountRowFieldsFragment, ref);
  return {
    id: account.id,
    href: routes.users.details(account.id),
    name: account.displayName,
    email: account.email ?? null,
    providers: providerMarks(account.source),
    customers: account.customers.map(toClaimingCustomer),
  };
}
