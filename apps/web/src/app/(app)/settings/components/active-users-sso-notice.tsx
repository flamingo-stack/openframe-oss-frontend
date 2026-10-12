'use client';

import { graphql, useLazyLoadQuery } from 'react-relay';
import type { activeUsersSsoNoticeQuery } from '@/__generated__/activeUsersSsoNoticeQuery.graphql';

const activeUsersSsoNoticeQueryNode = graphql`
  query activeUsersSsoNoticeQuery {
    users(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
  }
`;

/** "N users will switch…" — the server's count of active users, read when the dialog opens. */
export function ActiveUsersSsoNotice() {
  const { users } = useLazyLoadQuery<activeUsersSsoNoticeQuery>(
    activeUsersSsoNoticeQueryNode,
    {},
    { fetchPolicy: 'network-only' },
  );
  const count = users.filteredCount;
  return `${count} ${count === 1 ? 'user' : 'users'} will switch to signing in through SSO providers.`;
}
