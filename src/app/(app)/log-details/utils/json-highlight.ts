/** One colour-bearing slice of a pretty-printed JSON document. */
export interface JsonToken {
  /**
   * `key` is a property name without its quotes, `string` a string value
   * without its quotes; `scalar` covers numbers, booleans and null. Everything
   * else (quotes, braces, colons, commas, indentation, line breaks) is `punct`.
   */
  type: 'key' | 'string' | 'scalar' | 'punct';
  text: string;
}

/** Pretty-prints a value the way every JSON panel on the page shows and copies it. */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? '';
}

// A JSON string (with escapes), optionally followed by the colon that makes it
// a key, or a bare scalar. Everything the regex skips is punctuation.
const JSON_TOKEN = /"(?:[^"\\]|\\.)*"(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b/g;

/**
 * Splits pretty-printed JSON into tokens for syntax colouring. The input is
 * the output of {@link formatJson}, so it is valid JSON; the tokenizer still
 * never throws on anything else, it just colours what it recognises. Quotes
 * stay punctuation on purpose: the design colours only the name or the value
 * between them.
 */
export function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;

  const pushPunct = (text: string) => {
    if (text) tokens.push({ type: 'punct', text });
  };

  for (const match of json.matchAll(JSON_TOKEN)) {
    const [lexeme, colon] = match;
    pushPunct(json.slice(last, match.index));
    last = match.index + lexeme.length;

    if (lexeme.startsWith('"')) {
      const quoted = colon ? lexeme.slice(0, -colon.length) : lexeme;
      pushPunct('"');
      tokens.push({ type: colon ? 'key' : 'string', text: quoted.slice(1, -1) });
      pushPunct('"');
      pushPunct(colon ?? '');
    } else {
      tokens.push({ type: 'scalar', text: lexeme });
    }
  }
  pushPunct(json.slice(last));

  return tokens;
}
