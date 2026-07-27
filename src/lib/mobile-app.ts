import { nativePlatform } from './native-shell';
import { runtimeEnv } from './runtime-config';

/**
 * Whether this bundle is running as the mobile app (App Store / Google Play),
 * as opposed to the web app or the desktop shell.
 *
 * Primary signal is `NEXT_PUBLIC_IS_MOBILE_APP=true`, published by the mobile
 * shell into `window.__ENV` (openframe-saas-mobile `scripts/inject-env.mjs`).
 * `nativePlatform()` backs it up so a shell that hasn't been updated to publish
 * the flag still reads as mobile — store-compliance behavior must not hinge on
 * one env var being remembered. The desktop (Tauri) shell reports neither and
 * is deliberately not "mobile".
 *
 * Use this for anything that differs because the app ships through a store —
 * currently the payment UI (`billing-visibility.ts`).
 */
export function isMobileApp(): boolean {
  return runtimeEnv.isMobileApp() || nativePlatform() !== null;
}
