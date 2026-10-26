'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { employeeDetailsContentQuery } from '@/__generated__/employeeDetailsContentQuery.graphql';
import { CONTEXT_ENTITY_KIND } from '@/app/(app)/mingo/context/context-types';
import { useTrackOpenView } from '@/app/(app)/mingo/context/use-track-open-view';
import { useRetryKey } from '@/app/components/shared';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { toGlobalId } from '@/lib/relay-id';
import { EmployeeDetailsHeader } from './employee-details-header';
import { EmployeeDetailsSummary } from './employee-details-summary';

/**
 * One user — the header and the card. The work time fetches by id, so it is not
 * in here: the view mounts it beside this island rather than behind it.
 *
 * Any status resolves, a deleted user included; an unknown id resolves to null,
 * which the page reports as "not found".
 */
const employeeDetailsContentQueryNode = graphql`
  query employeeDetailsContentQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        # What the page reports to Mingo as the open view.
        ...userSummaryFields_user
        ...employeeDetailsHeader_user
        ...employeeDetailsSummary_user
      }
    }
  }
`;

/**
 * Everything on the page that waits for the record, with its own boundary. `userId` is the raw id the route carries.
 */
export function EmployeeDetailsContent({ userId }: { userId: string }) {
  return (
    <LoadingSuspense label="Loading employee">
      <EmployeeDetailsReader userId={userId} />
    </LoadingSuspense>
  );
}

/** In a loading scope (the boundary's fallback) it reads nothing: the header and the card draw their loading form. */
function EmployeeDetailsReader({ userId }: { userId: string }) {
  if (useLoadingScope()) {
    return (
      <>
        <EmployeeDetailsHeader user={null} />
        <EmployeeDetailsSummary user={null} />
      </>
    );
  }
  return <EmployeeDetailsQuery userId={userId} />;
}

function EmployeeDetailsQuery({ userId }: { userId: string }) {
  const retryKey = useRetryKey();
  const { node } = useLazyLoadQuery<employeeDetailsContentQuery>(
    employeeDetailsContentQueryNode,
    { id: toGlobalId('User', userId) },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const user = node?.__typename === 'User' ? node : null;
  const summary = user ? toUserSummary(user) : null;

  // The Mingo "open view": the USER resolver and the `@user:id` marker take the raw id.
  useTrackOpenView(summary ? { type: CONTEXT_ENTITY_KIND.USER, id: summary.rawId, label: summary.name } : null);

  return (
    <>
      <EmployeeDetailsHeader user={user} />
      {user ? <EmployeeDetailsSummary user={user} /> : <NotFoundError message="Employee not found" />}
    </>
  );
}
