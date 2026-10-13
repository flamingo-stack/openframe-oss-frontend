import type { MouseEvent } from 'react';

interface Router {
  push: (href: string) => void;
}

/**
 * Click handler that opens `href` in a new tab: the lib's, the one its own
 * tables use. Used for action buttons inside DataTable rows that render as
 * `<Link>`: `<a>` cannot be nested inside `<a>`, so the button must render as
 * `<button>` (no `href` prop) and trigger the new-tab open programmatically.
 */
export { openInNewTab } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Click handler that navigates to `href` in the same tab via the Next.js
 * router. Symmetric to `openInNewTab`, used for action buttons inside a row
 * `<Link>` that should navigate without opening a new tab. Pass the router
 * returned by `useRouter()` from `next/navigation`.
 */
export function navigateTo(router: Router, href: string) {
  return (e: MouseEvent) => {
    e.preventDefault();
    router.push(href);
  };
}
