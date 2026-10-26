'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { activeUsersSsoNoticeQuery } from '@/__generated__/activeUsersSsoNoticeQuery.graphql';

/** What the dialog says without the count: while it is read, and when the read fails. */
export const GENERIC_SSO_NOTICE = 'Users will switch to signing in through SSO providers.';

const activeUsersSsoNoticeQueryNode = graphql`
  query activeUsersSsoNoticeQuery {
    users(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
  }
`;

/**
 * "N users will switch…" — the server's count of active users, read when the dialog opens. An inline part of the
 * dialog's description: its boundary announces nothing and adds no block element.
 */
export function ActiveUsersSsoNotice() {
  return (
    <LoadingSuspense status={false} as="span">
      <ActiveUsersSsoNoticeReader />
    </LoadingSuspense>
  );
}

/** In a loading scope (the boundary's fallback) it reads nothing: the sentence reads the same without the count. */
function ActiveUsersSsoNoticeReader() {
  if (useLoadingScope()) return GENERIC_SSO_NOTICE;
  return <ActiveUsersSsoNoticeQuery />;
}

function ActiveUsersSsoNoticeQuery() {
  const { users } = useLazyLoadQuery<activeUsersSsoNoticeQuery>(
    activeUsersSsoNoticeQueryNode,
    {},
    { fetchPolicy: 'network-only' },
  );
  const count = users.filteredCount;
  return `${count} ${count === 1 ? 'user' : 'users'} will switch to signing in through SSO providers.`;
}
