/**
 * Relay wraps GraphQL errors as "No data returned for operation `x`, got error(s): <real message>".
 * The backend's own message is the only useful part in a toast — the wrapper eats the width and
 * pushes the actual reason past the truncation point.
 */
export function extractGraphqlErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const match = /got error\(s\):\s*([\s\S]+)/.exec(err.message);
  return (match?.[1] ?? err.message).trim() || fallback;
}
