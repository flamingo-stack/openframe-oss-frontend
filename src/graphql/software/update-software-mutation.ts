import { graphql } from 'react-relay';

/** Updates catalog packages on the given devices, now — one result per package. */
export const updateSoftwareMutation = graphql`
  mutation updateSoftwareMutation($input: SoftwareManagementInput!) {
    updateSoftware(input: $input) {
      packageManager
      packageName
      executionId
    }
  }
`;
