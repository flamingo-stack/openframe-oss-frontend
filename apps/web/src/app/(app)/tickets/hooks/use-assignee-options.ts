'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useState } from 'react';
import { fetchQuery, graphql, readInlineData, useRelayEnvironment } from 'react-relay';
import type { useAssigneeOptions_user$key } from '@/__generated__/useAssigneeOptions_user.graphql';
import type { useAssigneeOptionsQuery } from '@/__generated__/useAssigneeOptionsQuery.graphql';
import { getFullImageUrl } from '@/lib/image-url';
import { rawIdOf, toGlobalId } from '@/lib/relay-id';
import { useAuthStore } from '@/stores';
import type { AutocompleteOption, AvatarOption } from './use-ticket-options';

const assigneeOptionFragment = graphql`
  fragment useAssigneeOptions_user on User @inline {
    id
    firstName
    lastName
    email
    image {
      imageUrl
      hash
    }
  }
`;

const assigneeOptionsQuery = graphql`
  query useAssigneeOptionsQuery($search: String, $first: Int!, $selectedIds: [ID!]!) {
    users(filter: { statuses: [ACTIVE] }, search: $search, first: $first) {
      edges {
        node {
          ...useAssigneeOptions_user
        }
      }
    }
    selected: nodes(ids: $selectedIds) {
      __typename
      ...useAssigneeOptions_user
    }
  }
`;

function toOption(ref: useAssigneeOptions_user$key): AvatarOption {
  const user = readInlineData(assigneeOptionFragment, ref);
  return {
    label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '',
    value: rawIdOf(user.id),
    imageUrl: getFullImageUrl(user.image?.imageUrl, user.image?.hash),
  };
}

/** One page of matches: a picker narrows by typing, it never scrolls the whole tenant. */
const ASSIGNEE_OPTIONS_PAGE_SIZE = 50;

const EMPTY_AVATAR_OPTIONS: AvatarOption[] = [];

interface AssigneeOptionsArgs {
  /**
   * Users already selected (raw or global ids): listed even when the page or the
   * search does not contain them, so a selection never loses its label.
   */
  selectedIds?: readonly (string | null | undefined)[];
  enabled?: boolean;
  /** Puts the signed-in user first when the page contains them (self-assign shortcut). */
  selfFirst?: boolean;
}

/**
 * ACTIVE users as assignee options, searched on the server. Deleted users are not
 * assignable; an existing assignment still renders, marked, via useUserStatusMap.
 * The value is the raw user id the ticket and worktime APIs take.
 *
 * Hand `onSearchChange` to the picker's search input (debounced here). Does not
 * suspend: while the next search is in flight the previous options stay, so an
 * open list does not empty itself between keystrokes. A failed read leaves the
 * list empty without a toast, as before.
 */
export function useAssigneeOptions({ selectedIds = [], enabled = true, selfFirst = false }: AssigneeOptionsArgs = {}) {
  const environment = useRelayEnvironment();
  const currentUserId = useAuthStore(state => state.user?.id);
  const [input, setInput] = useState('');
  const search = useDebounce(input, 300);
  const [answer, setAnswer] = useState<{ search: string; options: AvatarOption[] } | null>(null);
  const selectedKey = [...new Set(selectedIds.filter((id): id is string => !!id).map(rawIdOf))].sort().join(',');

  useEffect(() => {
    if (!enabled) return undefined;
    const ids = selectedKey ? selectedKey.split(',').map(id => toGlobalId('User', id)) : [];
    const subscription = fetchQuery<useAssigneeOptionsQuery>(
      environment,
      assigneeOptionsQuery,
      { search: search || null, first: ASSIGNEE_OPTIONS_PAGE_SIZE, selectedIds: ids },
      { fetchPolicy: 'store-or-network' },
    ).subscribe({
      next: data => {
        const page = data.users.edges.map(({ node }) => toOption(node));
        const missing = data.selected
          .flatMap(node => (node?.__typename === 'User' ? [toOption(node)] : []))
          .filter(option => !page.some(o => o.value === option.value));
        setAnswer({ search, options: [...missing, ...page] });
      },
      error: () => setAnswer({ search, options: EMPTY_AVATAR_OPTIONS }),
    });
    return () => subscription.unsubscribe();
  }, [environment, enabled, search, selectedKey]);

  const options = answer?.options ?? EMPTY_AVATAR_OPTIONS;
  return {
    options: selfFirst ? sortSelfFirst(options, currentUserId) : options,
    isLoading: enabled && answer?.search !== search,
    onSearchChange: setInput,
  };
}

/** Move the signed-in user to the top of an assignee option list (self-assign shortcut). */
export function sortSelfFirst<T extends AutocompleteOption>(options: T[], currentUserId: string | undefined): T[] {
  const idx = currentUserId ? options.findIndex(o => o.value === currentUserId) : -1;
  if (idx <= 0) return options;
  return [options[idx], ...options.slice(0, idx), ...options.slice(idx + 1)];
}
