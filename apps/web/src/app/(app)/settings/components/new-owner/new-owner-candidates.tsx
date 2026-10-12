'use client';

import { type AutocompleteOption, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { newOwnerCandidatesQuery } from '@/__generated__/newOwnerCandidatesQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { NewOwnerField } from './new-owner-field';

const newOwnerCandidatesQueryNode = graphql`
  query newOwnerCandidatesQuery($search: String, $first: Int!) {
    members: users(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
    candidates: users(filter: { statuses: [ACTIVE] }, search: $search, first: $first) {
      edges {
        node {
          id
          ...userSummaryFields_user
        }
      }
    }
  }
`;

const CANDIDATES_LIMIT = 20;
const SUPPORT_EMAIL = 'hello@openframe.ai';

interface NewOwnerCandidatesProps {
  currentUserId: string;
  organizationName: string;
  search: string;
  /** The deferred search lags the box: the options shown are the previous answer. */
  isSearching: boolean;
  onSearch: (search: string) => void;
  /** The picked user's node id, which `transferOwnership` takes. */
  value: string;
  /** The option it was picked from, so it keeps its name after the search moves on. */
  picked: AutocompleteOption | null;
  onChange: (option: AutocompleteOption | null) => void;
  disabled: boolean;
}

/**
 * ACTIVE users other than the caller, searched on the server: DELETED users and
 * pending invitations can't receive the OWNER role.
 *
 * With no candidate at all (a sole-member workspace) the picker is replaced by
 * the two ways out — invite someone, or ask support to delete the workspace —
 * rather than a select nothing can be chosen from: a confirm that stays disabled
 * with no explanation is the dead end App Review reads as "no account deletion".
 */
export function NewOwnerCandidates({
  currentUserId,
  organizationName,
  search,
  isSearching,
  onSearch,
  value,
  picked,
  onChange,
  disabled,
}: NewOwnerCandidatesProps) {
  const retryKey = useRetryKey();
  const { members, candidates } = useLazyLoadQuery<newOwnerCandidatesQuery>(
    newOwnerCandidatesQueryNode,
    { search: search || null, first: CANDIDATES_LIMIT },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // The caller is one of the active members.
  if (members.filteredCount <= 1) {
    return (
      <p className="text-ods-text-primary text-h4">
        You&apos;re the only active member of {organizationName}, so there is no one to hand ownership to. Invite
        another member and make them the owner, or email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
          {SUPPORT_EMAIL}
        </a>{' '}
        to delete the workspace together with your account.
      </p>
    );
  }

  const options: AutocompleteOption[] = candidates.edges.flatMap(({ node }) => {
    const { rawId, name, avatarUrl } = toUserSummary(node);
    if (rawId === currentUserId) return [];
    return [
      {
        value: node.id,
        label: name || rawId,
        icon: <SquareAvatar src={avatarUrl} fallback={name} size="sm" variant="round" />,
      },
    ];
  });
  if (picked && !options.some(option => option.value === picked.value)) {
    options.unshift(picked);
  }

  return (
    <NewOwnerField
      options={options}
      value={value || null}
      onChange={id => onChange(options.find(option => option.value === id) ?? null)}
      onSearch={onSearch}
      loading={isSearching}
      disabled={disabled}
    />
  );
}
