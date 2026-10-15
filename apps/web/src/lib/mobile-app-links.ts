/**
 * Published listings for the OpenFrame Console mobile app: the force-update
 * fallback (`resolveStoreUrl` in `version-check.ts`) for a 426 whose body names
 * no listing and a policy that names none either. The download page reads its
 * store links from the server instead. The native shells repeat these for their
 * own 426 handling (`NotificationActions.swift`, `NotificationActionWorker.java`).
 */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/openframe-console/id6801064262';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ai.openframe.mobile';
