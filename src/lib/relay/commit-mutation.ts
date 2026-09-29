import { commitMutation } from 'react-relay';
import type { GraphQLTaggedNode, MutationParameters } from 'relay-runtime';
import { getRelayEnvironment } from '@/lib/relay';

/**
 * `commitMutation` as a promise for imperative services: GraphQL-level errors
 * reject with the first message, a network error rejects as is, the payload
 * resolves. Business refusals (`userErrors`) are the caller's to read.
 */
export function commitMutationPromise<TMutation extends MutationParameters>(
  mutation: GraphQLTaggedNode,
  variables: TMutation['variables'],
): Promise<TMutation['response']> {
  return new Promise((resolve, reject) => {
    commitMutation<TMutation>(getRelayEnvironment(), {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        if (errors?.length) reject(new Error(errors[0].message));
        else resolve(response);
      },
      onError: reject,
    });
  });
}
