/**
 * The app router, reachable from code that runs outside React.
 *
 * A notification click, a desktop OS toast or a chip handler may need to navigate
 * without holding a `useRouter()` of its own, and `window.location` would reload the
 * whole app (and, in the native shells, land on the root `index.html`). So the
 * `(app)` layout registers Next's router here once (`ShellNavigatorRegistrar`), and
 * {@link navigateInApp} pushes through it — a client-side navigation, like a link.
 *
 * One registration at a time: a second registrar replaces the first, and an
 * unregister only clears the slot if it still holds its own navigator, so a
 * remount's cleanup never removes the newer one.
 */
type Navigate = (href: string) => void;

let current: Navigate | null = null;

/** Install `navigate` as the app navigator; returns the matching unregister. */
export function registerShellNavigator(navigate: Navigate): () => void {
  current = navigate;
  return () => {
    if (current === navigate) current = null;
  };
}

/**
 * Client-side navigation to an in-app `href` (always a `routes.*` value). Returns
 * `false` when no `(app)` layout is mounted to navigate — then there is no app shell
 * to show the destination in either, and the caller decides what that means.
 */
export function navigateInApp(href: string): boolean {
  if (!current) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[shell-navigator] no navigator registered; dropped navigation to ${href}`);
    }
    return false;
  }
  current(href);
  return true;
}
