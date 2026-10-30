import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { rawIdOfType } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { navigateInApp } from '@/lib/shell-navigator';

/**
 * The dialog-open seam: every "open this Mingo conversation" in the app goes through
 * {@link openMingoDialog}, which opens it over the current page when the composer dock
 * can (the sheet, as the classic shell's drawer did), else on its chat page. A plain
 * function (store via `getState`, navigation via the registered shell navigator), so it
 * is callable from event handlers and from non-React code such as a desktop-notification
 * click.
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
 * The composer dock is mounted (an unlocked SaaS workspace), so {@link openMingoDialog}
 * opens the chat over the page instead of navigating. A caller that changes no URL then
 * marks what it opened read itself: the location-based auto-reader never sees it.
 */
export function canOpenMingoDialogOverPage(): boolean {
  return useMingoLauncherStore.getState().dockMounted;
}

/**
 * Open a Mingo dialog: over the current page when the dock is there (in its place on
 * another chat's page), else its chat page. `navigate` overrides the
 * registered shell navigator for that fallback — for a caller that already holds the router
 * it navigates everything else with.
 */
export function openMingoDialog(dialogId: string, options?: { navigate?: (href: string) => void }): void {
  if (canOpenMingoDialogOverPage()) {
    useMingoLauncherStore.getState().openDialog(dialogId);
    return;
  }
  const href = routes.mingo.chat(dialogId);
  if (options?.navigate) options.navigate(href);
  else navigateInApp(href);
}
