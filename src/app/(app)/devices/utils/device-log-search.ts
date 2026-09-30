// `DeviceLogFilterInput.contains/excludes`: max 5 terms of 256 characters each.
const MAX_TERMS = 5;
const MAX_TERM_LENGTH = 256;

export interface DeviceLogSearch {
  contains: string[];
  excludes: string[];
  /** Why the text cannot be sent; `contains`/`excludes` are then not applied. */
  error: string | null;
}

/** `"control channel" -heartbeat` → contains `control channel`, excludes `heartbeat`. */
export function parseDeviceLogSearch(input: string): DeviceLogSearch {
  const contains: string[] = [];
  const excludes: string[] = [];
  for (const token of input.match(/-?"[^"]*"|\S+/g) ?? []) {
    const negated = token.startsWith('-');
    const term = token.slice(negated ? 1 : 0).replace(/^"|"$/g, '');
    if (term) (negated ? excludes : contains).push(term);
  }

  let error: string | null = null;
  if ([...contains, ...excludes].some(term => term.length > MAX_TERM_LENGTH)) {
    error = `Search terms are limited to ${MAX_TERM_LENGTH} characters.`;
  } else if (contains.length > MAX_TERMS || excludes.length > MAX_TERMS) {
    error = `Use up to ${MAX_TERMS} search terms and ${MAX_TERMS} excluded terms.`;
  }
  return { contains, excludes, error };
}
