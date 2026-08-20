export interface GraphQlError {
  message: string;
  extensions?: unknown;
}

export interface GraphQlResponse<T> {
  data?: T;
  errors?: GraphQlError[];
}

/**
 * A GraphQL response that carried `errors`. `classification` is graphql-java's
 * error category — `ValidationError` when the deployed schema rejects the
 * document — and `undefinedFields` are the field names a `FieldUndefined`
 * validation error reports, so a caller can prune them and retry.
 *
 * The raw `message` stays off the user-facing path: a validation error names
 * internal types and is not copy a user can act on.
 */
export class GraphQlResponseError extends Error {
  readonly classification?: string;
  readonly undefinedFields: string[];

  constructor(message: string, options?: { classification?: string; undefinedFields?: string[] }) {
    super(message);
    this.name = 'GraphQlResponseError';
    this.classification = options?.classification;
    this.undefinedFields = options?.undefinedFields ?? [];
  }
}

// graphql-java phrasing for a field the schema does not declare, e.g.
// "Field 'escalatedByUser' in type 'Ticket' is undefined".
const UNDEFINED_FIELD_PATTERN = /Field '([^']+)' in type '[^']+' is undefined/g;

function classificationOf(error: GraphQlError): string | undefined {
  const classification = (error.extensions as { classification?: unknown } | undefined)?.classification;
  return typeof classification === 'string' ? classification : undefined;
}

/** Field names the response's validation errors report as undefined by the schema. */
export function undefinedFieldNames(errors: GraphQlError[]): string[] {
  const names = new Set<string>();
  for (const error of errors) {
    for (const match of error.message.matchAll(UNDEFINED_FIELD_PATTERN)) names.add(match[1]);
  }
  return [...names];
}

/** True for a deterministic schema-validation failure — retrying it cannot help. */
export function isGraphQlValidationError(error: unknown): boolean {
  return (
    error instanceof GraphQlResponseError &&
    (error.classification === 'ValidationError' || error.undefinedFields.length > 0)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove leaf field selections from a GraphQL document, so a document with one
 * field the deployed schema does not declare can be retried without it. Only a
 * plain scalar leaf is removed — a field with arguments, an alias or a
 * sub-selection is left in place, because it cannot be dropped without knowing
 * the shape it carries.
 */
export function pruneLeafFields(query: string, fields: string[]): string {
  let pruned = query;
  for (const field of fields) {
    // The field as a whole-word selection, not followed by `(`, `{` or `:`
    // (arguments, a sub-selection or an alias).
    const pattern = new RegExp(`\\b${escapeRegExp(field)}\\b(?!\\s*[({:])`, 'g');
    pruned = pruned.replace(pattern, '');
  }
  return pruned;
}

export function extractGraphQlData<T>(response: {
  ok: boolean;
  data?: GraphQlResponse<T>;
  error?: string;
  status?: number;
}): T {
  if (!response.ok) {
    throw new Error(response.error || `Request failed with status ${response.status}`);
  }

  const gql = response.data;
  if (gql?.errors && gql.errors.length > 0) {
    const first = gql.errors[0];
    throw new GraphQlResponseError(first.message || 'GraphQL error occurred', {
      classification: classificationOf(first),
      undefinedFields: undefinedFieldNames(gql.errors),
    });
  }

  if (!gql?.data) {
    throw new Error('No data received from server');
  }

  return gql.data;
}
