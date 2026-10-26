/**
 * The desktop sign-in the app is waiting on while it runs in the user's browser.
 *
 * `nativeLogin` is the one place every desktop browser sign-in goes through (the login tab, an SSO
 * signup, the sign-in after registering), so it publishes the wait here and the auth screens read it
 * to replace the form with the waiting screen. A plain module store rather than component state: the
 * wait outlives whichever screen started it, and `nativeLogin` is not a component.
 */

export interface DesktopSignInWait {
  /** Where the browser was sent. Opening it again starts the same sign-in over in a new tab. */
  loginUrl: string;
  /** Who is signing in, when the screen knew before the browser did. */
  email?: string;
  /** When the shell gives up on the browser (epoch ms). */
  deadline: number;
}

/** The shell's `LOGIN_TIMEOUT` (`apps/desktop/src-tauri/src/lib.rs`); a web test reads it from there. */
export const DESKTOP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

let current: DesktopSignInWait | null = null;
const listeners = new Set<() => void>();

function publish(next: DesktopSignInWait | null): void {
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeDesktopSignInWait(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDesktopSignInWait(): DesktopSignInWait | null {
  return current;
}

/**
 * Publishes a wait and returns what ends it. Ending is scoped to this wait: a sign-in started while
 * one is waiting supersedes it in the shell, and the superseded one's end must not take the newer
 * one's screen down with it.
 */
export function beginDesktopSignInWait(wait: DesktopSignInWait): () => void {
  publish(wait);
  return () => {
    if (current === wait) publish(null);
  };
}
