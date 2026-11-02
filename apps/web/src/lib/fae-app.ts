import { isDesktopShell, isMobileShell } from './platform';

/**
 * Opens Fae, the end-user chat the agent installs on a device, on THIS machine.
 * Its scheme is claimed by the chat app itself (HKCU on Windows, `Info.plist`
 * on macOS), and the link only brings its window forward.
 */
export const FAE_APP_URL = 'openframe-chat://open';

/** Fae runs on computers with the agent: never on a phone. */
export function canOpenFaeApp(): boolean {
  return !isMobileShell();
}

/**
 * Hand the link to whatever claims the scheme. The desktop shell gives a
 * `window.open` of it to the OS (`APP_LINK_SCHEMES`); a browser asks the user
 * first. Neither can tell whether Fae is installed: without it nothing opens.
 */
export function openFaeApp(): void {
  if (isDesktopShell()) {
    window.open(FAE_APP_URL, '_blank');
    return;
  }
  window.location.assign(FAE_APP_URL);
}
