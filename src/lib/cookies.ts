/**
 * Browser cookie access — the single owner of `document.cookie` parsing and serialization.
 *
 * Browser-only, and every entry point is a no-op outside the browser. A cookie that has to
 * outlive Safari's 7-day cap on JS-written cookies cannot be written from here at all — it
 * needs a `Set-Cookie` response header from a server that this app does not have (see
 * `referral-cookie.ts`).
 */

export interface CookieAttributes {
  name: string;
  /** Raw value — `writeCookie` URL-encodes it, `readCookie` decodes it back. */
  value: string;
  /** Leading-dot form (`.openframe.ai`) so the cookie is shared across subdomains. Omitted → host-only. */
  domain?: string;
  maxAgeSeconds: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
}

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function writeCookie(attributes: CookieAttributes): void {
  if (typeof document === 'undefined') return;

  const { name, value, domain, maxAgeSeconds, path = '/', sameSite = 'lax', secure } = attributes;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');

  try {
    document.cookie = parts.join('; ');
  } catch {}
}
