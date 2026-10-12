'use client';

import { useMemo } from 'react';
import { rawIdOf } from '@/lib/relay-id';
import { useUsersById } from './use-users-by-id';

/**
 * Whether the users a surface shows are deleted, for payloads that carry a user id
 * but no status (see useUsersById). Fail-open: until an id's answer lands, or when
 * the request fails, it reads as not deleted — the mark is decorative.
 *
 * Lookup accepts both raw ids and Relay global ids.
 */
export function useUserStatusMap(userIds: readonly (string | null | undefined)[]) {
  const { users } = useUsersById(userIds);
  const deletedKey = [...users.values()]
    .filter(user => user.deleted)
    .map(user => user.rawId)
    .sort()
    .join(',');

  // Memoized on the deleted ids, not on every answer: the board keys its card cache
  // on this function, so a new identity per answer would rebuild every card.
  const isUserDeleted = useMemo(() => {
    const deleted = new Set(deletedKey ? deletedKey.split(',') : []);
    return (id?: string | null): boolean => !!id && deleted.has(rawIdOf(id));
  }, [deletedKey]);

  return { isUserDeleted };
}
