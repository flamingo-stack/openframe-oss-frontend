import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { rawIdOfType } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { navigateInApp } from '@/lib/shell-navigator';
import { getShellVariant, type ShellVariant } from '@/lib/shell-variant';

/**
 * The dialog-open seam: every "open this Mingo conversation" in the app goes through
 * {@link openMingoDialog}, which decides between the classic shell's drawer and the
 * Mingo-first shell's chat page. Plain functions (stores via `getState`, navigation
 * via the registered shell navigator), so they are callable from event handlers and
 * from non-React code such as a desktop-notification click.
 */

/** Typename inside a Mingo dialog's Relay global id (`base64("Dialog:<rawId>")`). */
const MINGO_DIALOG_TYPENAME = 'Dialog';

/**
 * The raw dialog id for an id that may be a Relay global one — what a `?mingoDialog=`
 * link copied from a bundle older than the raw-id mapping carries. A raw id comes back
 * as is (`rawIdOfType` never decodes an id of another shape). Applied where an id
 * enters from a URL; ids from notifications and chips are raw already.
 */
export function normalizeMingoDialogId(id: string): string {
  return rawIdOfType(MINGO_DIALOG_TYPENAME, id);
}

/**
 * Opens a Mingo dialog in the classic shell's in-layout chat drawer. The drawer reads
 * the module-level Mingo store, so setting the active dialog + opening the launcher is
 * all it needs to render it; `resetUnread` clears the dialog's own badge.
 *
 * The drawer half of {@link openMingoDialog} — call that instead: this one does not
 * know whether a drawer exists, or whether the shell has one at all.
 */
export function openMingoDialogInDrawer(dialogId: string): void {
  const messages = useMingoMessagesStore.getState();
  messages.setActiveDialogId(dialogId);
  messages.resetUnread(dialogId);
  useMingoLauncherStore.getState().setOpen(true);
}

/** Where opening a dialog lands: the classic drawer, or the canonical chat route. */
export type MingoDialogSurface = 'drawer' | 'route';

/**
 * The drawer-or-route decision, pure, for a caller that must decide during render
 * (an `href` vs an `onClick`) and therefore SUBSCRIBES to both inputs itself.
 *
 * - `'classic'` with a drawer mounted (`MingoLauncherStore.canOpen`: an unlocked
 *   workspace) → the drawer, today's behaviour.
 * - `'mingo'` → the chat page.
 * - `'loading'`, or classic with no drawer (lock screen, shell unmounted) → the chat
 *   route as well. It never guesses: the page waits for the variant, and in the
 *   classic shell redirects to `/dashboard?mingoDialog=`, where the drawer's URL sync
 *   holds the id until a drawer exists — the fallback notifications always had.
 */
export function resolveMingoDialogSurface(variant: ShellVariant, canOpenDrawer: boolean): MingoDialogSurface {
  return variant === 'classic' && canOpenDrawer ? 'drawer' : 'route';
}

/**
 * Open a Mingo dialog wherever this shell shows one — see
 * {@link resolveMingoDialogSurface} for the decision. Returns where it went, so a
 * caller can do what only the drawer needs (mark a notification read: the drawer
 * changes no URL of its own for the location-based auto-reader to see).
 *
 * `navigate` overrides the registered shell navigator for the route half — for a
 * caller that already holds the router it navigates everything else with.
 */
export function openMingoDialog(dialogId: string, options?: { navigate?: (href: string) => void }): MingoDialogSurface {
  const surface = resolveMingoDialogSurface(getShellVariant(), useMingoLauncherStore.getState().canOpen);
  if (surface === 'drawer') {
    openMingoDialogInDrawer(dialogId);
    return 'drawer';
  }
  const href = routes.mingo.chat(dialogId);
  if (options?.navigate) options.navigate(href);
  else navigateInApp(href);
  return 'route';
}
