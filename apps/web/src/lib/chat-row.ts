/**
 * The rows this app writes into a chat thread itself (the operator's optimistic send, a client's direct reply on a
 * ticket): their id and the operator's name. Everything else about a thread is the lib's thread store.
 */

/**
 * Id for a locally-authored chat row. Collision-resistant without a uuid dep (time prefix orders, random suffix
 * disambiguates within the same ms), and ONE recipe, so every local row looks the way the reducer's echo consumption
 * expects.
 */
export function makeChatRowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Display name for an operator-authored row. This app's operator IS the admin, hence the fallback. */
export function adminDisplayName(user?: { firstName?: string; lastName?: string } | null): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';
}
