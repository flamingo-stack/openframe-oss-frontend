import type { GraphQlResponse } from '../../tickets/utils/graphql';

/** The classification graphql-java gives a query its schema cannot run (a field it does not have). */
const VALIDATION_ERROR = 'ValidationError';

function classificationOf(error: { extensions?: unknown }): string | null {
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null) return null;
  const { classification } = extensions as { classification?: unknown };
  return typeof classification === 'string' ? classification : null;
}

/**
 * The server refused to run the query at all: GraphQL errors and no `data`, whatever the HTTP status. When the errors
 * carry a classification, only a validation error is a refusal; a query that ran and failed is not one.
 */
export function isRefusedQuery(body: GraphQlResponse<unknown> | undefined): boolean {
  if (!body?.errors?.length || body.data != null) return false;
  const classifications = body.errors.map(classificationOf).filter((value): value is string => value !== null);
  return classifications.length === 0 || classifications.includes(VALIDATION_ERROR);
}
