import { graphql } from 'react-relay';

/**
 * Installs catalog packages on the given devices, now. Each package is its own
 * RMM execution, so the result is one row per package with its executionId.
 */
export const installSoftwareMutation = graphql`
  mutation installSoftwareMutation($input: SoftwareManagementInput!) {
    installSoftware(input: $input) {
      packageManager
      packageName
      executionId
    }
  }
`;
