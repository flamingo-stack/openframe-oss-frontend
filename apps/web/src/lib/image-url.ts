import { runtimeEnv } from './runtime-config';

/**
 * Build full image URL with API base URL prefix
 * @param imageUrl - relative or absolute image URL
 * @param hash - content hash appended as `?v=` to bust the browser cache when the image changes
 * @returns full URL with API base prefix, or undefined if no imageUrl provided
 */
export function getFullImageUrl(imageUrl: string | null | undefined, hash?: string | null): string | undefined {
  if (!imageUrl) {
    return undefined;
  }

  return appendImageHash(buildFullUrl(imageUrl), hash);
}

/**
 * Append a content `hash` as `?v=` to bust the browser cache when the image
 * changes. Not exported: a URL with its hash but without its host is what drew
 * initials on the tickets board (see "Images and Avatars" in CLAUDE.md).
 */
function appendImageHash(imageUrl: string, hash?: string | null): string {
  if (!hash) {
    return imageUrl;
  }
  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}v=${hash}`;
}

/**
 * The backend's own image paths, as it stores them: `/images/{type}/{id}` (saas-lib `Image.getImageUrl()`, with
 * `?v=<hash>` already on the remote-access copies) and `/knowledge-base/images/{id}`. The gateway serves both under
 * `/api`; the page's origin serves neither (the SPA catch-all on web, the bundle in a native shell).
 */
const BACKEND_IMAGE_PATH = /^\/(?:api\/)?(?:images|knowledge-base\/images)\//;

/**
 * Where a backend image path is served. Every picture the core lib draws passes through this first (the chat
 * runtime's auth adapter registers it as `resolveAssetUrl`), so a value that reached a picture without
 * `getFullImageUrl` still draws. Leaves every other URL as it is: absolute, `data:` / `blob:`, the bundle's
 * own files. Idempotent.
 */
export function resolveBackendImageUrl(url: string): string {
  return BACKEND_IMAGE_PATH.test(url) ? buildFullUrl(url) : url;
}

function buildFullUrl(imageUrl: string): string {
  // Already a full URL
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  const tenantHost = runtimeEnv.tenantHostUrl();

  // Already has /api/ prefix
  if (imageUrl.startsWith('/api/')) {
    return `${tenantHost}${imageUrl}`;
  }

  // Has leading slash but no /api/
  if (imageUrl.startsWith('/')) {
    return `${tenantHost}/api${imageUrl}`;
  }

  // No leading slash
  return `${tenantHost}/api/${imageUrl}`;
}
