const MAX_DEVICE_LOG_SEARCH_TERMS = 5;
const MAX_DEVICE_LOG_SEARCH_TERM_LENGTH = 256;

/**
 * The edge proxy answers these with a 502 before the API sees them (a WAF
 * rule DevOps owns), so they are refused here rather than sent.
 */
const REJECTED_TERM_PREFIXES = ['(?=', '(?>'];

export const DEVICE_LOG_SEARCH_REJECTED_MESSAGE = 'This search text was rejected — try different wording.';

export interface ParsedDeviceLogSearch {
  contains: string[];
  excludes: string[];
  /** Why the text cannot be sent; the previous valid filter stays in force. */
  error: string | null;
}

/** The "no search" parse: what the tab starts from before the URL is validated. */
export const EMPTY_DEVICE_LOG_SEARCH: ParsedDeviceLogSearch = { contains: [], excludes: [], error: null };

/**
 * `"control channel" -heartbeat` → `contains: ['control channel'], excludes: ['heartbeat']`.
 * Split on spaces; quoted text stays one term; a leading `-` excludes.
 */
export function parseDeviceLogSearch(input: string): ParsedDeviceLogSearch {
  const tokens = input.match(/-?"[^"]*"|\S+/g) ?? [];
  const contains: string[] = [];
  const excludes: string[] = [];
  for (const token of tokens) {
    const negated = token.startsWith('-');
    const term = token.slice(negated ? 1 : 0).replace(/^"|"$/g, '');
    if (term) {
      (negated ? excludes : contains).push(term);
    }
  }

  let error: string | null = null;
  const all = [...contains, ...excludes];
  if (all.some(term => REJECTED_TERM_PREFIXES.some(prefix => term.startsWith(prefix)))) {
    error = DEVICE_LOG_SEARCH_REJECTED_MESSAGE;
  } else if (all.some(term => term.length > MAX_DEVICE_LOG_SEARCH_TERM_LENGTH)) {
    error = `Search terms are limited to ${MAX_DEVICE_LOG_SEARCH_TERM_LENGTH} characters.`;
  } else if (contains.length > MAX_DEVICE_LOG_SEARCH_TERMS) {
    error = `Use up to ${MAX_DEVICE_LOG_SEARCH_TERMS} search terms.`;
  } else if (excludes.length > MAX_DEVICE_LOG_SEARCH_TERMS) {
    error = `Use up to ${MAX_DEVICE_LOG_SEARCH_TERMS} excluded terms.`;
  }

  return { contains, excludes, error };
}
