import { graphql, readInlineData } from 'react-relay';
import type { customerClaimFields_claim$key } from '@/__generated__/customerClaimFields_claim.graphql';
import { ruleKindLabel } from '@/app/(app)/cloud-tenant-management/utils/tenant-presentation';
import { getFullImageUrl } from '@/lib/image-url';
import { type CustomerOption, toCustomerOption } from './customer-option';

/** A customer that claims an account, as a row names it: the Users lists and a group's members. */
export const customerClaimFieldsFragment = graphql`
  fragment customerClaimFields_claim on DirectoryCustomerClaim @inline {
    organization {
      ...customerOption_organization
    }
    rule {
      kind
    }
    via
  }
`;

export interface ClaimingCustomer {
  name: string;
  imageUrl?: string;
  /** Which rule brought the customer in ("Group: Finance"), or null when the user was added to it directly. */
  claim: string | null;
}

/**
 * A customer's name and logo, the claim left null. A directory device's customers stay so (they claim the device's
 * declared owner, no rule brings them in); `toClaimingCustomer` starts from it and fills the claim in.
 */
export function toCustomer({ name, image }: CustomerOption): ClaimingCustomer {
  return { name, imageUrl: getFullImageUrl(image?.imageUrl, image?.hash), claim: null };
}

export function toClaimingCustomer(ref: customerClaimFields_claim$key): ClaimingCustomer {
  const { organization, rule, via } = readInlineData(customerClaimFieldsFragment, ref);
  const kind = rule ? ruleKindLabel(rule.kind) : null;
  return { ...toCustomer(toCustomerOption(organization)), claim: kind && via ? `${kind}: ${via}` : kind };
}
