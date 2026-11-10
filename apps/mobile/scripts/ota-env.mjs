// The window.__ENV script element: inject-env.mjs writes it into a store build's index.html, and
// the shells copy it from their built-in index.html into an over-the-air bundle's (docs/ota.md).
// One pattern and one insertion point for all three, pinned by fixtures/env-cases.json.
import { OtaError } from './ota-error.mjs';

/** The start of the element: an index.html holding it already carries an env. */
export const ENV_SCRIPT_START = /<script>window\.__ENV/;
const ENV_SCRIPT_ELEMENT = /<script>window\.__ENV[\s\S]*?<\/script>/;
const HEAD_TAG = '<head>';

/** The element for `env`, as inject-env.mjs writes it and the shells copy it. */
export const envScript = env => `<script>window.__ENV = ${JSON.stringify(env)};</script>`;

// A function replacement: a string one would read `$&` or `$'` inside the env as patterns.
const afterHead = (html, element) => html.replace(HEAD_TAG, () => HEAD_TAG + element);

/** inject-env.mjs: replaces the element if the page has one, else puts it after `<head>`. */
export function insertEnvScript(html, element) {
  if (ENV_SCRIPT_START.test(html)) {
    if (!ENV_SCRIPT_ELEMENT.test(html)) throw new Error('index.html has a window.__ENV script without its </script>');
    return html.replace(ENV_SCRIPT_ELEMENT, () => element);
  }
  if (!html.includes(HEAD_TAG)) throw new Error('index.html has no <head>');
  return afterHead(html, element);
}

/**
 * What a bundle's index.html must be for the shells to give it their env: free of an env of its own
 * (HAS_ENV), with a `<head>` to put one after (NO_HEAD).
 */
export function assertEnvTarget(stagedHtml) {
  if (ENV_SCRIPT_START.test(stagedHtml)) throw new OtaError('HAS_ENV', 'the bundle already carries window.__ENV');
  if (!stagedHtml.includes(HEAD_TAG)) throw new OtaError('NO_HEAD', "the bundle's index.html has no <head>");
}

/** The shells: the built-in page's element, copied after `<head>` in a bundle that has none. */
export function copyEnvScript(builtinHtml, stagedHtml) {
  const element = builtinHtml.match(ENV_SCRIPT_ELEMENT)?.[0];
  if (!element) throw new OtaError('NO_ENV', 'the built-in index.html has no window.__ENV script');
  assertEnvTarget(stagedHtml);
  return afterHead(stagedHtml, element);
}
