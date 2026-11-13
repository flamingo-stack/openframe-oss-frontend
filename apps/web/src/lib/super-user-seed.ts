/**
 * The super user strip's room before the first paint.
 *
 * The strip (`SuperUserBanner`) mounts once `/me` has answered, so a persisted flag from a
 * previous session cannot show it ahead of the session. On its own that put the strip in
 * after the first paint, and every page moved down by its height (57px on a desktop). The
 * root layout's `<head>` runs this before paint: a session that was a super user's last time
 * marks `<html>`, and the shell draws the strip's loading form in its place until `/me`
 * answers (`SuperUserBannerSeed`). Server-safe: the root layout (a server component) emits it.
 */

/** The auth store's persisted key (`auth-store.ts`, zustand `persist`: `{ state: { user } }`). */
export const AUTH_STORAGE_KEY = 'auth-storage';

/** Set on `<html>` before paint for a session whose stored user is a super user. */
export const SUPER_USER_SEED_ATTRIBUTE = 'data-super-user';

export function superUserSeedScript(): string {
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(AUTH_STORAGE_KEY)}));if(s&&s.state&&s.state.user&&s.state.user.isSuperUser===true){document.documentElement.setAttribute('${SUPER_USER_SEED_ATTRIBUTE}','');}}catch(e){}})();`;
}
