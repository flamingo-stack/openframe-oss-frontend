import { graphql, readInlineData } from 'react-relay';
import type {
  customerOption_organization$data,
  customerOption_organization$key,
} from '@/__generated__/customerOption_organization.graphql';

// One selection for every customer the picker shows: the listed ones and a connection's bound one.
const customerOptionFragment = graphql`
  fragment customerOption_organization on Organization @inline {
    organizationId
    name
    image {
      imageUrl
      hash
    }
  }
`;

export type CustomerOption = Omit<customerOption_organization$data, ' $fragmentType'>;

export function toCustomerOption(ref: customerOption_organization$key): CustomerOption {
  const { organizationId, name, image } = readInlineData(customerOptionFragment, ref);
  return { organizationId, name, image: image ? { imageUrl: image.imageUrl, hash: image.hash } : null };
}
