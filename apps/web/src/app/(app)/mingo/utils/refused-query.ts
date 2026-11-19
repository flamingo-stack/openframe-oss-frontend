import type { GraphQlResponse } from '../../tickets/utils/graphql';

/** The classification graphql-java gives a query its schema cannot run (a field it does not have). */
const VALIDATION_ERROR = 'ValidationError';

/** An error's `extensions` when they are an object with something in it, else null. */
function extensionsOf(error: { extensions?: unknown }): Record<string, unknown> | null {
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null) return null;
  return Object.keys(extensions).length > 0 ? (extensions as Record<string, unknown>) : null;
}

function classificationOf(error: { extensions?: unknown }): string | null {
  const classification = extensionsOf(error)?.classification;
  return typeof classification === 'string' ? classification : null;
}

/**
 * The server refused to run the query at all: GraphQL errors and no `data`, whatever the HTTP status.
 *
 * - The ai-agent (graphql-java) names a refusal: `classification: 'ValidationError'`.
 * - The federation router names nothing: its own validation error is a message and a path, with no `extensions`.
 * - Every other error carries `extensions` without a classification: a resolver that rejected its arguments (the
 *   ai-agent's `code` and `errorType`), or such an error the router passes on (`serviceName`, `statusCode`). The query
 *   ran, so it is not a refusal, even when `data` is null.
 */
export function isRefusedQuery(body: GraphQlResponse<unknown> | undefined): boolean {
  if (!body?.errors?.length || body.data != null) return false;
  const classifications = body.errors.map(classificationOf).filter((value): value is string => value !== null);
  if (classifications.length > 0) return classifications.includes(VALIDATION_ERROR);
  return body.errors.every(error => extensionsOf(error) === null);
}
