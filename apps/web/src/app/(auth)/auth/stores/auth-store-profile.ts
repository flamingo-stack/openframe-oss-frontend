import { fetchQuery, graphql } from 'react-relay';
import type { authStoreProfileQuery } from '@/__generated__/authStoreProfileQuery.graphql';
import { getRelayEnvironment } from '@/lib/relay';
import { toGlobalId } from '@/lib/relay-id';

const authStoreProfileQueryNode = graphql`
  query authStoreProfileQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        firstName
        lastName
        email
        emailVerified
        status
        roles
        image {
          imageUrl
          hash
        }
      }
    }
  }
`;

/**
 * The signed-in user's full profile, as the auth store merges it over `/me`: only
 * the fields the API answered, so a missing one never blanks what the store has.
 * Null when the API does not know the id.
 *
 * Imperative on purpose: it hydrates the Zustand auth store — a second source of
 * truth that lives outside any Relay page — at session start. Components read the
 * user through their own fragments; do not add readers of this. Its own module,
 * loaded on demand, so the store (imported everywhere) does not pull Relay in.
 */
export async function fetchProfile(userId: string) {
  const data = await fetchQuery<authStoreProfileQuery>(
    getRelayEnvironment(),
    authStoreProfileQueryNode,
    { id: toGlobalId('User', userId) },
    { fetchPolicy: 'network-only' },
  ).toPromise();
  const user = data?.node?.__typename === 'User' ? data.node : null;
  if (!user) return null;
  return {
    ...(user.firstName != null && { firstName: user.firstName }),
    ...(user.lastName != null && { lastName: user.lastName }),
    ...(user.email != null && { email: user.email }),
    emailVerified: user.emailVerified,
    ...(user.status != null && { status: user.status }),
    roles: [...user.roles],
    ...(user.image && { image: { imageUrl: user.image.imageUrl ?? '', hash: user.image.hash ?? '' } }),
  };
}
