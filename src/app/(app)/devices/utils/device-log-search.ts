// `DeviceLogFilterInput.contains` / `excludes`: at most 5 terms of 256 characters each (`DeviceLogService`).
const MAX_SEARCH_TERMS = 5;
const MAX_SEARCH_LENGTH = 256;

/** One term of the search box: a quoted phrase or a bare word, either behind a leading `-`. */
const TERM_PATTERN = /-?"[^"]*"|\S+/g;

export interface DeviceLogSearch {
  contains: string[];
  excludes: string[];
  /** Why the text cannot be sent; `contains` and `excludes` are then not applied. */
  error: string | null;
}

/** `"control channel" failed -heartbeat` → contains `control channel`, `failed`; excludes `heartbeat`. */
export function parseDeviceLogSearch(text: string): DeviceLogSearch {
  const contains: string[] = [];
  const excludes: string[] = [];

  for (const token of text.match(TERM_PATTERN) ?? []) {
    const excluded = token.startsWith('-');
    const term = stripQuotes(excluded ? token.slice(1) : token);
    if (term === '') continue;
    if (excluded) excludes.push(term);
    else contains.push(term);
  }

  return { contains, excludes, error: searchLimitError(contains, excludes) };
}

function stripQuotes(token: string): string {
  return token.replace(/^"|"$/g, '');
}

function searchLimitError(contains: string[], excludes: string[]): string | null {
  const tooLong = [...contains, ...excludes].some(term => term.length > MAX_SEARCH_LENGTH);
  if (tooLong) return `Search terms are limited to ${MAX_SEARCH_LENGTH} characters.`;

  const tooMany = contains.length > MAX_SEARCH_TERMS || excludes.length > MAX_SEARCH_TERMS;
  if (tooMany) return `Use up to ${MAX_SEARCH_TERMS} search terms and ${MAX_SEARCH_TERMS} excluded terms.`;

  return null;
}
