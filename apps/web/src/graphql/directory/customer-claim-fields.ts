import { graphql, readInlineData } from 'react-relay';
import type { customerClaimFields_claim$key } from '@/__generated__/customerClaimFields_claim.graphql';
import { ruleKindLabel } from '@/app/(app)/cloud-tenant-management/utils/tenant-presentation';
import { getFullImageUrl } from '@/lib/image-url';

/** A customer that claims an account, as a row names it: the Users lists and a group's members. */
export const customerClaimFieldsFragment = graphql`
  fragment customerClaimFields_claim on DirectoryCustomerClaim @inline {
    organization {
      name
      image {
        imageUrl
        hash
      }
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

export function toClaimingCustomer(ref: customerClaimFields_claim$key): ClaimingCustomer {
  const { organization, rule, via } = readInlineData(customerClaimFieldsFragment, ref);
  const kind = rule ? ruleKindLabel(rule.kind) : null;
  return {
    name: organization.name,
    imageUrl: getFullImageUrl(organization.image?.imageUrl, organization.image?.hash),
    claim: kind && via ? `${kind}: ${via}` : kind,
  };
}
