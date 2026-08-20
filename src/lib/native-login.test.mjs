// Framework-free tests for the native-shell OAuth login flow.
//
// The frontend repo has no test runner; these run on Node's built-in test module with its
// native TypeScript stripping — `node --test src/lib/native-login.test.mjs`, or `npm test`.
//
// nativeLogin pulls in the whole auth graph (auth-api-client -> token-store -> force-logout),
// so the loader hooks below stand in for what bundlers give the app: extensionless/`@/`
// resolution, plus two module stubs for packages that assume a browser at import time
// (next-runtime-env is CJS-only here, and the core-lib hooks barrel touches `document` at
// module scope). Everything under src/lib runs for real.

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { beforeEach, test } from 'node:test';

const SRC = new URL('../', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next-runtime-env') return { url: 'stub:next-runtime-env', shortCircuit: true };
    if (specifier === '@flamingo-stack/openframe-frontend-core/hooks') {
      return { url: 'stub:core-hooks', shortCircuit: true };
    }
    const spec = specifier.startsWith('@/') ? `${SRC}${specifier.slice(2)}` : specifier;
    if (/^(\.\.?\/|file:)/.test(spec) && !/\.[a-z]+$/.test(spec)) {
      return nextResolve(`${spec}.ts`, context);
    }
    return nextResolve(spec, context);
  },
  load(url, context, nextLoad) {
    if (url === 'stub:next-runtime-env') {
      return { format: 'module', shortCircuit: true, source: 'export const env = k => globalThis.testEnv[k];' };
    }
    if (url === 'stub:core-hooks') {
      return { format: 'module', shortCircuit: true, source: 'export const clearAuthedImageCache = () => {};' };
    }
    return nextLoad(url, context);
  },
});

const TENANT_HOST = 'https://acme.openframe.example';
const SHARED_HOST = 'https://auth.openframe.example';

let startCalls = [];
let storedTokens = null;

/**
 * Stands in for the Tauri shell's `__OPENFRAME_SHELL__.nativeAuth` bridge. `start` completes
 * the way the gateway does — by sending the devTicket to the login URL's own `redirectTo`.
 * Without one the real shell simply never sees a callback and the promise hangs forever; a
 * rejection is the testable stand-in for that.
 */
function fakeNativeAuth() {
  return {
    start: async options => {
      startCalls.push(options);
      const redirectTo = new URL(options.url).searchParams.get('redirectTo');
      if (!redirectTo) throw new Error('no redirectTo — the real shell would wait for a callback that never comes');
      if (!options.callbackScheme) throw new Error('no callbackScheme — the shell has no navigation to cancel on');
      return { callbackUrl: `${redirectTo}?devTicket=TICKET-123` };
    },
    exchangeTicket: async () => ({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
    getTokens: async () => ({}),
    setTokens: async tokens => {
      storedTokens = tokens;
    },
    clearTokens: async () => {},
    setTenantHost: async () => {},
  };
}

/**
 * Desktop shell (Tauri globals) in saas-shared mode — the mode whose browser logins
 * deliberately drop a caller-supplied redirectTo.
 */
function resetDesktopShell() {
  startCalls = [];
  storedTokens = null;
  const storage = new Map();
  globalThis.testEnv = {
    NEXT_PUBLIC_APP_MODE: 'saas-shared',
    NEXT_PUBLIC_TENANT_HOST_URL: TENANT_HOST,
    NEXT_PUBLIC_SHARED_HOST_URL: SHARED_HOST,
  };
  globalThis.window = {
    // biome-ignore-start lint/style/useNamingConvention: shell-injected global names
    __TAURI__: {},
    __OPENFRAME_SHELL__: { nativeAuth: fakeNativeAuth() },
    // biome-ignore-end lint/style/useNamingConvention: shell-injected global names
    location: { pathname: '/auth', hostname: 'localhost', origin: 'null', search: '' },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.localStorage = globalThis.window.localStorage;
}

// platform.ts memoizes the shell kind per module instance, so this file is desktop-only
// by construction — mobile/web belong in their own file if they ever get one.
resetDesktopShell();
const { nativeLogin } = await import('./native-login.ts');
const { APP_SCHEME } = await import('./native-shell.ts');

beforeEach(resetDesktopShell);

test('saas-shared desktop login keeps its scheme callback in the login URL', async () => {
  await nativeLogin({ tenantId: 'tenant-1', provider: 'google' });

  assert.equal(startCalls.length, 1);
  const url = new URL(startCalls[0].url);

  assert.equal(url.origin, SHARED_HOST, 'shared mode logs in through the shared auth host');
  assert.equal(
    url.searchParams.get('redirectTo'),
    `${APP_SCHEME}://auth`,
    'without redirectTo the gateway never sends the callback start() is blocked on',
  );
  assert.equal(url.searchParams.get('tenantId'), 'tenant-1');
  assert.equal(url.searchParams.get('provider'), 'google');
});

test('desktop login asks for the ticket the same way mobile does', async () => {
  await nativeLogin({ tenantId: 'tenant-1' });

  const options = startCalls[0];
  const url = new URL(options.url);

  // Without authMobile the callback carries no ticket at all wherever dev-ticket
  // issuance is off (prod) — the login window then waits on a URL that never comes.
  assert.equal(url.searchParams.get('authMobile'), 'true');
  assert.equal(options.callbackScheme, APP_SCHEME, 'the shell cancels the navigation to this scheme');
});

test('saas-shared desktop login exchanges the ticket and keeps the boot host', async () => {
  const result = await nativeLogin({ tenantId: 'tenant-1' });

  assert.deepEqual(storedTokens, { accessToken: 'access-1', refreshToken: 'refresh-1' });
  assert.equal(result.tenantHostChanged, false, 'the scheme callback leaves the discovered host standing');
});

test('a discovered tenant domain overrides the boot host and is reported as a change', async () => {
  const result = await nativeLogin({ tenantId: 'tenant-1', tenantDomain: 'other.openframe.example' });

  assert.equal(result.tenantHostChanged, true);
});

test('an https landing still carries the login when the gateway drops the requested redirect', async () => {
  // What every environment with dev-ticket issuance on does with a redirect it
  // does not allow-list: the ticket rides on the tenant landing instead.
  globalThis.window.__OPENFRAME_SHELL__.nativeAuth.start = async () => ({
    callbackUrl: `${TENANT_HOST}/?devTicket=TICKET-123`,
  });

  const result = await nativeLogin({ tenantId: 'tenant-1' });

  assert.deepEqual(storedTokens, { accessToken: 'access-1', refreshToken: 'refresh-1' });
  assert.equal(result.tenantHostChanged, false);
});

test('a callback without a ticket fails loudly', async () => {
  globalThis.window.__OPENFRAME_SHELL__.nativeAuth.start = async () => ({
    callbackUrl: `${APP_SCHEME}://auth`,
  });

  await assert.rejects(() => nativeLogin({ tenantId: 'tenant-1' }), /without a ticket/);
});
