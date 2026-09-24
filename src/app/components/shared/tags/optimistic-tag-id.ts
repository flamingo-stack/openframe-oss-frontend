/**
 * Prefix of the placeholder id a picker hands its form while `createTag` is in
 * flight. The picker swaps it for the persisted id when the create lands; a
 * submit that races the create must not send it, the backend has never seen it.
 *
 * Its own module, free of Relay `graphql` tags, so the form hooks that filter
 * on it stay importable in a unit test without the Relay babel transform.
 */
export const OPTIMISTIC_TAG_ID_PREFIX = '_optimistic_';

export function isOptimisticTagId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_TAG_ID_PREFIX);
}
