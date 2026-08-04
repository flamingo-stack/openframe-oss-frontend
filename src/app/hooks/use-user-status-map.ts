'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { fetchUsers, type UserStatus, usersQueryKeys } from '@/app/(app)/settings/hooks/use-users';
import { isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { decodeGlobalId } from '@/lib/relay-id';

/**
 * Client-side id → status map over `GET /api/users`, for surfaces whose own
 * payload carries no user status:
 *
 * - GraphQL `User` is a stub with no `status` field (scripts v2 initiators/
 *   authors, worktime entries, KB authors) — a BE spec to add it exists, this
 *   map is the interim join;
 * - tickets (`/chat/graphql`) denormalize the assignee to id + name snapshot.
 *
 * Lookup accepts both raw ids and Relay global ids (`User:<id>` base64) — the
 * map is keyed by the raw id `/api/users` returns, and `isUserDeleted` decodes
 * a global id before looking it up.
 *
 * Deliberately fail-open: an id missing from the map answers "not deleted".
 * That covers REMOVED (purged) users — who never appear in `/api/users` but
 * arrive already anonymized from the backend — and viewers whose role can't
 * list users (the query error just leaves the map empty; no toast, since the
 * feature is decorative).
 */
export function useUserStatusMap() {
  const query = useQuery({
    // Same key as the employees page's full-list query, so the two share cache.
    queryKey: usersQueryKeys.list(0, 1000),
    queryFn: () => fetchUsers(0, 1000),
    staleTime: 5 * 60 * 1000,
  });

  const statusById = useMemo(() => {
    const map = new Map<string, UserStatus>();
    for (const user of query.data?.items ?? []) {
      map.set(user.id, user.status);
    }
    return map;
  }, [query.data]);

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
