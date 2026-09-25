/**
 * Which client build is talking to the backend, sent as one header on every
 * request to the tenant gateway:
 *
 *   X-OpenFrame-Client: <kind>/<shellVersion|-> bundle/<bundleVersion>
 *   e.g. web/- bundle/1.0.127 · ios/1.0.1 bundle/1.0.127 · desktop/0.4.2 bundle/1.0.127
 *
 * It exists so a schema removal can be gated on data: the native shells carry a
 * frozen copy of this bundle, and a GraphQL field one of them still selects fails
 * its whole query. Bundles built before this header existed never send it — the
 * backend classifies those by `Origin` instead.
 *
 * Only the tenant gateway gets it (api-client, Relay, the embedded chat, the
 * upload helpers). The shared auth host is left out on purpose: several of its
 * calls are CORS-simple today, and a custom header would turn every one into a
 * preflight on the login path. Presigned storage URLs and third-party hosts never
 * get it either — an unsigned extra header can fail a signed PUT.
 */
import { nativeShellVersion } from './native-shell';
import { mobilePlatform, shellKind } from './platform';

export const CLIENT_IDENTITY_HEADER = 'X-OpenFrame-Client';

// Inlined by `next build` from next.config.mjs `env` — deliberately not a
// runtime variable, so nothing injected into `window.__ENV` can make a bundle
// report a version it is not.
const BUNDLE_VERSION = process.env.OPENFRAME_BUNDLE_VERSION || 'unknown';

let shellVersion: string | null = null;
let shellVersionRequested = false;

/**
 * Header values reject control characters outright (`fetch` throws a TypeError),
 * and a space would break the header's own grammar. The shell version comes from
 * the native side, so it is reduced to version-string characters before it can
 * take every request down with it.
 */
function token(value: string): string {
  return value.replace(/[^\w.+-]/g, '_');
}

function clientKind(): string {
  const kind = shellKind();
  return kind === 'mobile' ? (mobilePlatform() ?? 'mobile') : kind;
}

export function clientIdentityValue(): string {
  return `${clientKind()}/${shellVersion ? token(shellVersion) : '-'} bundle/${token(BUNDLE_VERSION)}`;
}

export function clientIdentityHeaders(): Record<string, string> {
  return { [CLIENT_IDENTITY_HEADER]: clientIdentityValue() };
}

/**
 * Resolves the shell version once per document. The bridge answers
 * asynchronously, so requests sent before it lands report `-` — they still carry
 * the bundle version, which is the part a deprecation cutoff is decided on.
 */
export function primeShellVersion(): void {
  if (shellVersionRequested) return;
  shellVersionRequested = true;
  void nativeShellVersion().then(version => {
    shellVersion = version;
  });
}
