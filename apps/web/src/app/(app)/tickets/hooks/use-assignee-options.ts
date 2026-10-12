'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql } from 'react-relay';
import type { useAssigneeOptionsQuery } from '@/__generated__/useAssigneeOptionsQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { useUsersById } from '@/app/hooks/use-users-by-id';
import { toUserSummary, type UserSummary } from '@/graphql/users/user-summary-fields';
import { useAuthStore } from '@/stores';
import type { AutocompleteOption, AvatarOption } from './use-ticket-options';

const assigneeOptionsQuery = graphql`
  query useAssigneeOptionsQuery($search: String, $first: Int!, $list: Boolean!) {
    users(filter: { statuses: [ACTIVE] }, search: $search, first: $first) @include(if: $list) {
      edges {
        node {
          ...userSummaryFields_user
        }
      }
    }
  }
`;

/** One page of matches: a picker narrows by typing, it never scrolls the whole tenant. */
export const ASSIGNEE_OPTIONS_PAGE_SIZE = 50;
/**
 * A column header filter has no search box, so it lists the most the API pages at
 * once (`first` is capped at 100) — a searchable header filter needs a lib change.
 */
export const ASSIGNEE_FILTER_PAGE_SIZE = 100;

function toOption({ name, rawId, avatarUrl }: UserSummary): AvatarOption {
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
   * search does not contain them, so a selection never loses its label. Asked for
   * apart from the page, so changing the selection does not ask for the page again.
   */
  selectedIds?: readonly (string | null | undefined)[];
  enabled?: boolean;
  /** Puts the signed-in user first when the page contains them (self-assign shortcut). */
  selfFirst?: boolean;
  pageSize?: number;
}

/**
 * ACTIVE users as assignee options, searched on the server. Deleted users are not
 * assignable; an existing assignment still renders, marked, via useUserStatusMap.
 * The value is the raw user id the ticket and worktime APIs take.
 *
 * Hand `onSearchChange` to the picker's search input. Never suspends or throws
 * (see useNonSuspendingQuery): the previous options stay on screen, with
 * `isLoading`, until the next answer lands, and a failed request leaves them.
 */
export function useAssigneeOptions({
  selectedIds = [],
  enabled = true,
  selfFirst = false,
  pageSize = ASSIGNEE_OPTIONS_PAGE_SIZE,
}: AssigneeOptionsArgs = {}) {
  const currentUserId = useAuthStore(state => state.user?.id);
  const [input, setInput] = useState('');
  const search = useDebounce(input, 300).trim();

  const page = useNonSuspendingQuery<useAssigneeOptionsQuery>(
    assigneeOptionsQuery,
    { search: search || null, first: pageSize, list: true },
    enabled,
  );
  const selected = useUsersById(enabled ? selectedIds : []);

  const pageOptions = (page.data.users?.edges ?? [])
    .map(({ node }) => toUserSummary(node))
    // The page was ACTIVE when it was fetched; a user deleted since (the delete
    // mutation updates the same record) is no longer assignable.
    .filter(user => !user.deleted)
    .map(toOption);
  const missing = [...selected.users.values()]
    .map(toOption)
    .filter(option => !pageOptions.some(o => o.value === option.value));
  const options = [...missing, ...pageOptions];

  return {
    options: selfFirst ? sortSelfFirst(options, currentUserId) : options,
    isLoading: enabled && (page.isLoading || selected.isLoading || input.trim() !== search),
    onSearchChange: setInput,
  };
}
