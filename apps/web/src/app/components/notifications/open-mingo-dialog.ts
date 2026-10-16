import { rawIdOfType } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { navigateInApp } from '@/lib/shell-navigator';

/**
 * The dialog-open seam: every "open this Mingo conversation" in the app goes through
 * {@link openMingoDialog}, which navigates to the chat page. A plain function (navigation
 * via the registered shell navigator), so it is callable from event handlers and from
 * non-React code such as a desktop-notification click.
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
 * Open a Mingo dialog: its chat page. `navigate` overrides the registered shell
 * navigator — for a caller that already holds the router it navigates everything else with.
 */
export function openMingoDialog(dialogId: string, options?: { navigate?: (href: string) => void }): void {
  const href = routes.mingo.chat(dialogId);
  if (options?.navigate) options.navigate(href);
  else navigateInApp(href);
}
