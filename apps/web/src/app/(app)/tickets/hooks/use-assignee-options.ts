'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useDeferredValue, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useAssigneeOptionsQuery } from '@/__generated__/useAssigneeOptionsQuery.graphql';
import type { userSummaryFields_user$key } from '@/__generated__/userSummaryFields_user.graphql';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { rawIdOf, toGlobalId } from '@/lib/relay-id';
import { useAuthStore } from '@/stores';
import type { AutocompleteOption, AvatarOption } from './use-ticket-options';

/**
 * `@include(if: $list)` is off for the first render only: read `store-only`, that
 * paints the picker without a request, and the listing arrives in the deferred
 * re-render — the same shape as the software package search.
 */
const assigneeOptionsQuery = graphql`
  query useAssigneeOptionsQuery($search: String, $first: Int!, $selectedIds: [ID!]!, $list: Boolean!) {
    users(filter: { statuses: [ACTIVE] }, search: $search, first: $first) @include(if: $list) {
      edges {
        node {
          ...userSummaryFields_user
        }
      }
    }
    selected: nodes(ids: $selectedIds) @include(if: $list) {
      __typename
      ...userSummaryFields_user
    }
  }
`;

/** One page of matches: a picker narrows by typing, it never scrolls the whole tenant. */
const ASSIGNEE_OPTIONS_PAGE_SIZE = 50;
/** The deferred request's first-render value: nothing asked yet, not even the empty search. */
const NOT_YET = null;

function toOption(ref: userSummaryFields_user$key): AvatarOption {
  const { name, rawId, avatarUrl } = toUserSummary(ref);
  return { label: name, value: rawId, imageUrl: avatarUrl };
}

/** Move the signed-in user to the top of an assignee option list (self-assign shortcut). */
export function sortSelfFirst<T extends AutocompleteOption>(options: T[], currentUserId: string | undefined): T[] {
  const idx = currentUserId ? options.findIndex(o => o.value === currentUserId) : -1;
  if (idx <= 0) return options;
  return [options[idx], ...options.slice(0, idx), ...options.slice(idx + 1)];
}

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
 * Hand `onSearchChange` to the picker's search input. The request is deferred, so
 * a search never suspends the picker: the previous options stay on screen, with
 * `isLoading`, until the next answer lands.
 */
export function useAssigneeOptions({ selectedIds = [], enabled = true, selfFirst = false }: AssigneeOptionsArgs = {}) {
  const currentUserId = useAuthStore(state => state.user?.id);
  const [input, setInput] = useState('');
  const search = useDebounce(input, 300).trim();
  const selected = [...new Set(selectedIds.filter((id): id is string => !!id).map(rawIdOf))].sort().join(',');
  // A string, not an object: a deferred value is compared by identity.
  const request = enabled ? `${search}\n${selected}` : NOT_YET;
  const deferred = useDeferredValue<string | null>(request, NOT_YET);
  const list = deferred !== NOT_YET;
  const [deferredSearch = '', deferredSelected = ''] = deferred?.split('\n') ?? [];

  const data = useLazyLoadQuery<useAssigneeOptionsQuery>(
    assigneeOptionsQuery,
    {
      search: deferredSearch || null,
      first: ASSIGNEE_OPTIONS_PAGE_SIZE,
      selectedIds: deferredSelected ? deferredSelected.split(',').map(id => toGlobalId('User', id)) : [],
      list,
    },
    { fetchPolicy: list ? 'store-or-network' : 'store-only' },
  );

  const page = (data.users?.edges ?? []).map(({ node }) => toOption(node));
  const missing = (data.selected ?? [])
    .flatMap(node => (node?.__typename === 'User' ? [toOption(node)] : []))
    .filter(option => !page.some(o => o.value === option.value));
  const options = [...missing, ...page];

  return {
    options: selfFirst ? sortSelfFirst(options, currentUserId) : options,
    isLoading: enabled && (deferred !== request || input.trim() !== search),
    onSearchChange: setInput,
  };
}
