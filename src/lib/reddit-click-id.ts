export const RDT_CID_PARAM = 'rdt_cid';
export const RDT_CID_SESSION_KEY = 'rdt_cid';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function captureRedditClickIdFromUrl(): string | null {
  if (!isBrowser()) return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(RDT_CID_PARAM);

    if (value?.trim()) {
      const trimmed = value.trim();
      try {
        window.sessionStorage.setItem(RDT_CID_SESSION_KEY, trimmed);
      } catch {
        // Storage is a nice-to-have here: a private window or blocked site data throws on write, and the click id is still returned to the caller from the URL.
      }
      return trimmed;
    }
  } catch {
    // A malformed or absent query string is not an error — there is simply no click id to read.
  }

  return null;
}

export function getStoredRedditClickId(): string | null {
  if (!isBrowser()) return null;

  try {
    const value = window.sessionStorage.getItem(RDT_CID_SESSION_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredRedditClickId(value: string | null | undefined): void {
  if (!isBrowser()) return;

  try {
    const trimmed = value?.trim();
    if (trimmed) {
      window.sessionStorage.setItem(RDT_CID_SESSION_KEY, trimmed);
    }
  } catch {
    // Same as the reader: an unavailable sessionStorage means the id is not remembered, which is degraded ad attribution and never a user-visible failure.
  }
}

export function clearStoredRedditClickId(): void {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(RDT_CID_SESSION_KEY);
  } catch {
    // Nothing to clear if storage cannot be reached — the value it would have held could not have been written either.
  }
}
