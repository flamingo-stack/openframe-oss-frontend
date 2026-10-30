import { graphql, readInlineData } from 'react-relay';
import type { boundCustomer_customer$key } from '@/__generated__/boundCustomer_customer.graphql';
import { type BoundCustomer, storedOption } from './attribution-helpers';
import { type PickerCustomer, toCustomerOption } from './customer-option';

// One selection for a customer bound to a directory, spread wherever one is shown, so every screen names it alike.
const boundCustomerFragment = graphql`
  fragment boundCustomer_customer on DirectoryConnectionCustomer @inline {
    organizationId
    organization {
      status
      ...customerOption_organization
    }
  }
`;

/** The selection as plain data, for code that keeps no fragment reference (the forms). */
export function readBoundCustomer(ref: boundCustomer_customer$key): BoundCustomer {
  const { organizationId, organization } = readInlineData(boundCustomerFragment, ref);
  return {
    organizationId,
    organization: organization ? { ...toCustomerOption(organization), status: organization.status } : null,
  };
}

/** A bound customer named and badged as every screen shows it (`storedOption`). */
export function boundCustomerOption(ref: boundCustomer_customer$key): PickerCustomer {
  return storedOption(readBoundCustomer(ref));
}

/** Every bound customer, the active ones first: a cell with room for one leads with one. */
export function boundCustomerOptions(refs: readonly boundCustomer_customer$key[]): PickerCustomer[] {
  return refs.map(boundCustomerOption).sort((a, b) => Number(!!a.badge) - Number(!!b.badge));
}
