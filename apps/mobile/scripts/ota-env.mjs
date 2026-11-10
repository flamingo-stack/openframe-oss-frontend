// The window.__ENV script element: inject-env.mjs writes it into a store build's index.html, and
// the shells copy it from their built-in index.html into an over-the-air bundle's (docs/ota.md).
// One pattern and one insertion point for all three, pinned by fixtures/env-cases.json.
import { OtaError } from './ota-error.mjs';

/** The start of the element: an index.html holding it already carries an env. */
export const ENV_SCRIPT_START = /<script>window\.__ENV/;
/** The whole element, as inject-env.mjs writes it. */
export const ENV_SCRIPT_ELEMENT = /<script>window\.__ENV[\s\S]*?<\/script>/;
/** The element goes right after the first literal `<head>`. */
export const HEAD = '<head>';

// A function replacement: a string one would read `$&` or `$'` inside the env as patterns.
const afterHead = (html, element) => html.replace(HEAD, () => HEAD + element);

/** inject-env.mjs: replaces the element if the page has one, else puts it after `<head>`. */
export function insertEnvScript(html, element) {
  if (ENV_SCRIPT_START.test(html)) {
    if (!ENV_SCRIPT_ELEMENT.test(html)) throw new Error('index.html has a window.__ENV script without its </script>');
    return html.replace(ENV_SCRIPT_ELEMENT, () => element);
  }
  if (!html.includes(HEAD)) throw new OtaError('NO_HEAD', 'index.html has no <head>');
  return afterHead(html, element);
}

/** The shells: the built-in page's element, copied after `<head>` in a bundle that has none. */
export function copyEnvScript(builtinHtml, stagedHtml) {
  const element = builtinHtml.match(ENV_SCRIPT_ELEMENT)?.[0];
  if (!element) throw new OtaError('NO_ENV', 'the built-in index.html has no window.__ENV script');
  if (ENV_SCRIPT_START.test(stagedHtml)) throw new OtaError('HAS_ENV', 'the bundle already carries window.__ENV');
  if (!stagedHtml.includes(HEAD)) throw new OtaError('NO_HEAD', "the bundle's index.html has no <head>");
  return afterHead(stagedHtml, element);
}
