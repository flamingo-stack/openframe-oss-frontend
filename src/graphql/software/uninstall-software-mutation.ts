import { graphql } from 'react-relay';

/**
 * Dispatches an uninstall of one software title to the given machines. Returns
 * the dispatch's `executionId` — the agent does the work asynchronously, so the
 * row's status only changes once the backend reports it (the tab refetches).
 */
export const uninstallSoftwareMutation = graphql`
  mutation uninstallSoftwareMutation($input: UninstallSoftwareInput!) {
    uninstallSoftware(input: $input) {
      executionId
    }
  }
`;
