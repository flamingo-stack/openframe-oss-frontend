import { graphql } from 'react-relay';

/** Chat operations read by the Relay compiler; callers import their generated requests. */
export const readQuery = graphql`
  # eslint-disable-next-line relay/unused-fields
  query mingoModelOperationsReadQuery($id: ID!) {
    dialog(id: $id) {
      id
      dialogId
      agentType
      status
      streamState
      pendingApproval {
        id
      }
      modelTokenBudget
      model {
        provider
        modelName
        displayName
      }
      effectiveModel {
        provider
        modelName
        displayName
      }
    }
  }
`;

export const updateMutation = graphql`
  mutation mingoModelOperationsUpdateMutation($input: UpdateDialogModelInput!) {
    updateDialogModel(input: $input) {
      dialog {
        id
        dialogId
        agentType
        status
        streamState
        pendingApproval {
          id
        }
        modelTokenBudget
        model {
          provider
          modelName
          displayName
        }
        effectiveModel {
          provider
          modelName
          displayName
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;
