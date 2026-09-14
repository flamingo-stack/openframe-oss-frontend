'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchUsers, type UserStatus, usersQueryKeys } from '@/app/(app)/settings/hooks/use-users';
import { isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { decodeGlobalId } from '@/lib/relay-id';

type UsersPage = Awaited<ReturnType<typeof fetchUsers>>;

const EMPTY_STATUS_MAP = new Map<string, UserStatus>();

/**
 * One map per query payload, shared by every consumer — the tickets board
 * renders this hook once per card, and a per-component `useMemo` had each of
 * them building its own 1000-entry map (and handing out a fresh `isUserDeleted`
 * identity, which re-rendered every memoized card below it). react-query's
 * structural sharing keeps the payload identity stable across refetches, so a
 * WeakMap keyed on it rebuilds only when the user list actually changes.
 */
const statusMapByPayload = new WeakMap<UsersPage, Map<string, UserStatus>>();

function statusMapFor(data: UsersPage | undefined): Map<string, UserStatus> {
  if (!data) return EMPTY_STATUS_MAP;
  const cached = statusMapByPayload.get(data);
  if (cached) return cached;
  const map = new Map<string, UserStatus>();
  for (const user of data.items ?? []) map.set(user.id, user.status);
  statusMapByPayload.set(data, map);
  return map;
}

/**
 * Client-side id → status map over `GET /api/users`, for surfaces whose own
 * payload carries no user status. Since the backend added `User.status` to
 * the GraphQL schema, the scripts / worktime / KB surfaces read it from
 * their own payloads — the ONLY remaining consumer is the tickets domain:
 * `/chat/graphql` (saas-ai-agent) denormalizes the assignee to an id + name
 * snapshot with no status.
 *
 * Lookup accepts both raw ids and Relay global ids (`User:<id>` base64) — the
 * map is keyed by the raw id `/api/users` returns, and `isUserDeleted` decodes
 * a global id before looking it up.
 *
 * Deliberately fail-open: an id missing from the map answers "not deleted".
 * That covers REMOVED (purged) users — who never appear in `/api/users` but
 * arrive already anonymized from the backend — and viewers whose role can't
 * list users (the query error just leaves the map empty; intentionally no
 * toast, since the feature is decorative and a permissions-denied viewer
 * would otherwise see a spurious error on every page).
 *
 * Known cap: one page of 1000 users — in a larger tenant, users past the
 * first page would render unmarked. Accepted for now: the employees page has
 * the same cap (TODO there), and the proper fix is the pending BE spec that
 * exposes `status` on the GraphQL `User` type.
 */
export function useUserStatusMap() {
  const query = useQuery({
    // Same key as the employees page's full-list query, so the two share cache.
    queryKey: usersQueryKeys.list(0, 1000),
    queryFn: () => fetchUsers(0, 1000),
    staleTime: 5 * 60 * 1000,
  });

  const statusById = statusMapFor(query.data);

  const isUserDeleted = useCallback(
    (id?: string | null): boolean => {
      if (!id) return false;
      const rawId = decodeGlobalId(id)?.rawId ?? id;
      return isDeletedUserStatus(statusById.get(rawId) ?? statusById.get(id));
    },
    [statusById],
  );

  const isUserSelfDeleted = useCallback(
    (id?: string | null): boolean => {
      if (!id) return false;
      const rawId = decodeGlobalId(id)?.rawId ?? id;
      return isSelfDeletedUserStatus(statusById.get(rawId) ?? statusById.get(id));
    },
    [statusById],
  );

  return { statusById, isUserDeleted, isUserSelfDeleted, isLoading: query.isLoading };
}
