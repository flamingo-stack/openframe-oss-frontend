/**
 * Shared response envelope + error handling for raw-POST hooks against the
 * ai-agent's `/chat/graphql` (the sanctioned non-Relay GraphQL domain).
 */

export interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export interface MutationPayloadGql {
  userErrors: { message: string }[];
}

/** Throws on transport failures and GraphQL errors; resolves to the query's `data`. */
export function queryDataOrThrow<T>(
  response: { ok: boolean; error?: string; data?: GraphqlResponse<T> },
  fallbackMessage: string,
): T {
  if (!response.ok || !response.data) throw new Error(response.error || fallbackMessage);
  if (response.data.errors?.length) throw new Error(response.data.errors.map(e => e.message).join(', '));
  if (!response.data.data) throw new Error(fallbackMessage);
  return response.data.data;
}

/**
 * Throws on transport failures, GraphQL errors, and the payload's
 * `userErrors` (checked on the first root field of the mutation response).
 */
export function throwOnErrors(
  response: { ok: boolean; error?: string; data?: GraphqlResponse<Record<string, MutationPayloadGql>> },
  fallbackMessage: string,
): void {
  if (!response.ok || !response.data) throw new Error(response.error || fallbackMessage);
  if (response.data.errors?.length) throw new Error(response.data.errors.map(e => e.message).join(', '));
  const payload = response.data.data && Object.values(response.data.data)[0];
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0) throw new Error(userErrors.map(e => e.message).join(', '));
}
